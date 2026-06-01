import test from "node:test";
import assert from "node:assert/strict";
import { buildDigest, parseRepo } from "../src/pulse.js";

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
