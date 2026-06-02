const GITHUB_API = "https://api.github.com";

export function parseRepo(value) {
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(value || "");
  if (!match) {
    throw new Error("Repository must use owner/name format");
  }

  return {
    owner: match[1],
    name: match[2],
    fullName: `${match[1]}/${match[2]}`,
  };
}

export async function fetchGitHubItems({ repo, limit = 30, token = "", label = "", author = "" }) {
  parseRepo(repo);

  const url = new URL(`${GITHUB_API}/repos/${repo}/issues`);
  url.searchParams.set("state", "open");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", String(limit));

  if (label) {
    url.searchParams.set("labels", label);
  }

  if (author) {
    url.searchParams.set("creator", author);
  }

  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "oss-maintainer-pulse",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function buildDigest(items, options = {}) {
  const now = options.now || new Date();
  const staleDays = options.staleDays || 7;
  const repo = options.repo || "unknown/repo";

  let normalized = items.map((item) => normalizeItem(item, now, staleDays));
  normalized = filterNormalizedItems(normalized, options);
  const pullRequests = normalized.filter((item) => item.kind === "pull_request");
  const issues = normalized.filter((item) => item.kind === "issue");
  const stale = normalized.filter((item) => item.isStale);
  const needsMaintainerResponse = normalized.filter((item) => item.needsMaintainerResponse);
  const likelyBountyClaims = normalized.filter((item) => item.hasClaim);

  const summary = {
    repo,
    generatedAt: now.toISOString(),
    totals: {
      open: normalized.length,
      pullRequests: pullRequests.length,
      issues: issues.length,
      stale: stale.length,
      needsMaintainerResponse: needsMaintainerResponse.length,
      likelyBountyClaims: likelyBountyClaims.length,
    },
    needsMaintainerResponse,
    stale,
    likelyBountyClaims,
    recent: normalized.slice(0, 10),
  };

  return {
    ...summary,
    markdown: renderMarkdown(summary),
  };
}

function filterNormalizedItems(items, options) {
  let filtered = items;

  if (options.author) {
    const normalizedAuthor = normalizeFilterValue(options.author);
    filtered = filtered.filter((item) => normalizeFilterValue(item.author) === normalizedAuthor);
  }

  if (options.label) {
    const requiredLabels = options.label
      .split(",")
      .map((label) => normalizeFilterValue(label))
      .filter(Boolean);
    filtered = filtered.filter((item) =>
      requiredLabels.every((label) =>
        item.labels.some((itemLabel) => normalizeFilterValue(itemLabel) === label),
      ),
    );
  }

  return filtered;
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeItem(item, now, staleDays) {
  const updatedAt = new Date(item.updated_at || item.created_at || now);
  const ageDays = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000);
  const labels = (item.labels || []).map((label) =>
    typeof label === "string" ? label : label.name,
  );
  const body = item.body || "";
  const isPullRequest = Boolean(item.pull_request);
  const hasClaim = /(^|\s)\/claim\b/i.test(body) || labels.some((label) => /bounty|claim/i.test(label));
  const authorAssociation = item.author_association || "";
  const needsMaintainerResponse =
    isPullRequest &&
    ageDays >= 2 &&
    !["MEMBER", "OWNER", "COLLABORATOR"].includes(authorAssociation);

  return {
    number: item.number,
    title: item.title,
    url: item.html_url,
    kind: isPullRequest ? "pull_request" : "issue",
    author: item.user?.login || "unknown",
    labels,
    updatedAt: updatedAt.toISOString(),
    ageDays,
    comments: item.comments || 0,
    hasClaim,
    isStale: ageDays >= staleDays,
    needsMaintainerResponse,
  };
}

function renderMarkdown(summary) {
  const lines = [
    `# Maintainer Pulse: ${summary.repo}`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Open items: ${summary.totals.open}`,
    `- Pull requests: ${summary.totals.pullRequests}`,
    `- Issues: ${summary.totals.issues}`,
    `- Needs maintainer response: ${summary.totals.needsMaintainerResponse}`,
    `- Stale: ${summary.totals.stale}`,
    `- Likely bounty claims: ${summary.totals.likelyBountyClaims}`,
    "",
  ];

  appendSection(lines, "Needs Maintainer Response", summary.needsMaintainerResponse);
  appendSection(lines, "Stale Items", summary.stale);
  appendSection(lines, "Likely Bounty Claims", summary.likelyBountyClaims);
  appendSection(lines, "Recent Activity", summary.recent);

  return lines.join("\n");
}

function appendSection(lines, title, items) {
  lines.push(`## ${title}`, "");
  if (items.length === 0) {
    lines.push("- None", "");
    return;
  }

  for (const item of items) {
    const labels = item.labels.length ? ` labels: ${item.labels.join(", ")}` : "";
    lines.push(
      `- #${item.number} ${item.kind === "pull_request" ? "PR" : "Issue"}: ` +
        `[${item.title}](${item.url}) by @${item.author}; updated ${item.ageDays}d ago; ` +
        `${item.comments} comments${labels}`,
    );
  }

  lines.push("");
}
