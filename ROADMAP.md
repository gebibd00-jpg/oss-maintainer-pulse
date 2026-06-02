# Roadmap

## 0.1

- Local and public GitHub API input.
- Markdown and JSON output.
- Stale item detection.
- Likely bounty or claim detection.
- Basic maintainer response queue.

## 0.2

- `--label`, `--author`, and `--kind` filters.
- Better maintainer response detection using comment timeline inspection.
- Update the weekly triage example to support reusing a single rolling issue.

## 0.3

- Release checklist digest.
- Security advisory and dependency update section.
- Maintainer workload trend report from multiple runs.

## Principles

- Keep the CLI dependency-light.
- Prefer auditable heuristics over opaque scoring.
- Make output easy to paste into GitHub issues, PR comments, release notes, or chat.
