import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildDigest, fetchGitHubItems, parseRepo } from "../src/pulse.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = fileURLToPath(new URL("../bin/oss-maintainer-pulse.js", import.meta.url));
const samplePath = fileURLToPath(new URL("./sample.json", import.meta.url));
const execFile = promisify(execFileCallback);

test("parseRepo accepts owner/name", () => {
  assert.deepEqual(parseRepo("openai/codex"), {
    owner: "openai",
    name: "codex",
    fullName: "openai/codex",
  });
});

test("parseRepo rejects malformed values", () => {
  assert.throws(() => parseRepo("openai"), /owner\/name/);
  assert.throws(() => parseRepo("openai/codex/extra"), /owner\/name/);
});

test("buildDigest separates issues, pull requests, stale items, and claims", () => {
  const digest = buildDigest(
    [
      {
        number: 12,
        title: "Add small regression test",
        html_url: "https://github.com/example/tool/pull/12",
        pull_request: {},
        updated_at: "2026-05-25T00:00:00Z",
        created_at: "2026-05-24T00:00:00Z",
        body: "/claim #71",
        comments: 2,
        labels: [{ name: "tests" }],
        user: { login: "contributor" },
        author_association: "CONTRIBUTOR",
      },
      {
        number: 13,
        title: "Document setup",
        html_url: "https://github.com/example/tool/issues/13",
        updated_at: "2026-05-31T00:00:00Z",
        body: "",
        comments: 0,
        labels: ["docs"],
        user: { login: "maintainer" },
        author_association: "OWNER",
      },
    ],
    {
      repo: "example/tool",
      staleDays: 5,
      now: new Date("2026-06-01T00:00:00Z"),
    },
  );

  assert.equal(digest.totals.open, 2);
  assert.equal(digest.totals.pullRequests, 1);
  assert.equal(digest.totals.issues, 1);
  assert.equal(digest.totals.stale, 1);
  assert.equal(digest.totals.needsMaintainerResponse, 1);
  assert.equal(digest.totals.likelyBountyClaims, 1);
  assert.match(digest.markdown, /Maintainer Pulse: example\/tool/);
  assert.match(digest.markdown, /Likely Bounty Claims/);
});

test("buildDigest filters normalized items by kind, author, and label case-insensitively", () => {
  const digest = buildDigest(
    [
      {
        number: 12,
        title: "Add small regression test",
        html_url: "https://github.com/example/tool/pull/12",
        pull_request: {},
        updated_at: "2026-05-25T00:00:00Z",
        created_at: "2026-05-24T00:00:00Z",
        body: "/claim #71",
        comments: 2,
        labels: [{ name: "tests" }, { name: "priority" }],
        user: { login: "contributor" },
        author_association: "CONTRIBUTOR",
      },
      {
        number: 13,
        title: "Document setup",
        html_url: "https://github.com/example/tool/issues/13",
        updated_at: "2026-05-31T00:00:00Z",
        body: "",
        comments: 0,
        labels: ["Docs", "Priority"],
        user: { login: "Maintainer" },
        author_association: "OWNER",
      },
    ],
    {
      repo: "example/tool",
      staleDays: 5,
      now: new Date("2026-06-01T00:00:00Z"),
      kind: "issue",
      author: "maintainer",
      label: "docs,priority",
    },
  );

  assert.equal(digest.totals.open, 1);
  assert.equal(digest.totals.pullRequests, 0);
  assert.equal(digest.totals.issues, 1);
  assert.equal(digest.recent[0].number, 13);
});

test("fetchGitHubItems keeps paging until filtered kind reaches limit", async () => {
  const calls = [];
  const pageOne = Array.from({ length: 100 }, (_, index) => ({
    number: index + 1,
    ...(index === 99 ? {} : { pull_request: {} }),
  }));
  const pageTwo = [
    { number: 101 },
    { number: 102, pull_request: {} },
  ];

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(url.toString());
    const page = new URL(url).searchParams.get("page");
    const items = page === "1" ? pageOne : pageTwo;
    return {
      ok: true,
      json: async () => items,
    };
  };

  try {
    const items = await fetchGitHubItems({
      repo: "example/tool",
      limit: 2,
      kind: "issue",
      author: "maintainer",
      label: "docs",
    });

    assert.deepEqual(
      items.map((item) => item.number),
      [100, 101],
    );
    assert.equal(calls.length, 2);
    assert.match(calls[0], /creator=maintainer/);
    assert.match(calls[0], /labels=docs/);
    assert.match(calls[0], /per_page=100/);
    assert.match(calls[1], /page=2/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("CLI applies local input filters and preserves JSON output", async () => {
  const { stdout, stderr } = await execFile(
    process.execPath,
    [
      cliPath,
      "--input",
      samplePath,
      "--author",
      "maintainer",
      "--label",
      "docs",
      "--kind",
      "issue",
      "--format",
      "json",
    ],
    {
      cwd: __dirname,
    },
  );

  assert.equal(stderr, "");
  const digest = JSON.parse(stdout);
  assert.equal(digest.totals.open, 1);
  assert.equal(digest.totals.issues, 1);
  assert.equal(digest.totals.pullRequests, 0);
  assert.equal(digest.recent[0].author, "maintainer");
  assert.deepEqual(digest.recent[0].labels, ["docs"]);
});
