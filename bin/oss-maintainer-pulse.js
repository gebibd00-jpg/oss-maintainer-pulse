#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { stdin, stdout, stderr, exit } from "node:process";
import { buildDigest, fetchGitHubItems, parseRepo } from "../src/pulse.js";

const usage = `oss-maintainer-pulse

Usage:
  oss-maintainer-pulse --repo owner/name [--days 7] [--format markdown|json] [--limit 30]
  oss-maintainer-pulse --input sample.json [--format markdown|json]

Options:
  --repo       Public GitHub repository in owner/name form.
  --input      JSON file with GitHub issue/search API items. Use "-" for stdin.
  --days       Stale threshold in days. Default: 7.
  --format     Output format: markdown or json. Default: markdown.
  --limit      Maximum GitHub items to fetch. Default: 30.
  --label      Filter by label name. Comma-separated labels require all labels.
  --token      GitHub token. Defaults to GITHUB_TOKEN when present.
`;

function parseArgs(argv) {
  const args = {
    days: 7,
    format: "markdown",
    limit: 30,
    token: process.env.GITHUB_TOKEN || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.days = Number(args.days);
  args.limit = Number(args.limit);

  if (!Number.isFinite(args.days) || args.days < 1) {
    throw new Error("--days must be a positive number");
  }

  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 100) {
    throw new Error("--limit must be between 1 and 100");
  }

  if (!["markdown", "json"].includes(args.format)) {
    throw new Error("--format must be markdown or json");
  }

  return args;
}

async function readInput(path) {
  if (path === "-") {
    let data = "";
    for await (const chunk of stdin) {
      data += chunk;
    }
    return JSON.parse(data);
  }

  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      stdout.write(`${usage}\n`);
      return;
    }

    if (!args.repo && !args.input) {
      throw new Error("Pass either --repo owner/name or --input file.json");
    }

    const repo = args.repo ? parseRepo(args.repo) : null;
    const items = args.input
      ? await readInput(args.input)
      : await fetchGitHubItems({
          repo: repo.fullName,
          limit: args.limit,
          token: args.token,
          label: args.label,
        });

    const digest = buildDigest(items, {
      repo: repo?.fullName || "local-input",
      staleDays: args.days,
      now: new Date(),
      label: args.label
    });

    stdout.write(
      args.format === "json"
        ? `${JSON.stringify(digest, null, 2)}\n`
        : `${digest.markdown}\n`,
    );
  } catch (error) {
    stderr.write(`${error.message}\n\n${usage}\n`);
    exit(1);
  }
}

await main();
