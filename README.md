# oss-maintainer-pulse

`oss-maintainer-pulse` is a small zero-dependency CLI that turns open GitHub issues and pull requests into a maintainer-friendly triage digest.

It is built for maintainers who need a quick daily view of:

- pull requests that likely need maintainer response
- stale issues and pull requests
- likely bounty or claim-based contributions
- recent activity that should be reviewed before a release

## Why this exists

Small open-source projects often do not need a large dashboard. They need a simple digest that can be pasted into a GitHub issue, release note, maintainer log, or chat thread.

This project started from real maintainer and contributor workflow needs: tracking GitHub PRs, bounty claims, stale review queues, and whether a maintainer needs to reply.

## Install

```bash
npm install -g oss-maintainer-pulse
```

For local development:

```bash
git clone https://github.com/gebibd00-jpg/oss-maintainer-pulse.git
cd oss-maintainer-pulse
npm test
```

## Usage

Generate a Markdown digest for a public repository:

```bash
oss-maintainer-pulse --repo outerbase/starbasedb --days 7
```

Generate JSON:

```bash
oss-maintainer-pulse --repo arakoodev/EdgeChains --format json
```

Use a token to avoid public GitHub API rate limits:

```bash
GITHUB_TOKEN=ghp_xxx oss-maintainer-pulse --repo owner/name
```

Filter by label, author, or kind:

```bash
oss-maintainer-pulse --repo owner/name --label docs,triage --author octocat --kind issue
```

Use saved GitHub API JSON:

```bash
oss-maintainer-pulse --input test/sample.json
```

## Example output

```markdown
# Maintainer Pulse: owner/name

## Summary

- Open items: 12
- Pull requests: 4
- Issues: 8
- Needs maintainer response: 2
- Stale: 3
- Likely bounty claims: 1
```

## Roadmap

- GitHub Actions workflow that posts a scheduled digest to an issue
- optional comment timeline inspection for more accurate "needs response" detection
- release checklist generation
- maintainer workload trend report

## GitHub Actions Example

An optional scheduled workflow example lives at [examples/weekly-triage.yml](./examples/weekly-triage.yml).

It is designed for maintainers who want a lightweight weekly triage issue without adding dependencies beyond Node and the GitHub CLI already available on GitHub-hosted runners.

The example expects:

- repository `issues: write` permission so it can open a triage issue
- the default `GITHUB_TOKEN` available in Actions
- the repository checkout, because it runs `bin/oss-maintainer-pulse.js` directly

## Contributing

Issues and focused pull requests are welcome. Please keep changes small and reviewable:

1. Open an issue or comment on an existing one.
2. Add or update tests for behavior changes.
3. Run `npm test` and `npm run lint`.
4. Include validation notes in the PR description.

## Maintenance Policy

This project aims to stay small, dependency-light, and easy to audit. New features should improve maintainer workflows without turning the CLI into a heavy dashboard.

## License

MIT
