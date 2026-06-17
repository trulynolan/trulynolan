// Generates a GitHub-stats card SVG (tokyonight theme) using the authenticated
// user's own token, so PRIVATE org contributions (e.g. Proflyt) are counted.
// Renders to assets/github-stats.svg. Run: GH_TOKEN=$(gh auth token) node scripts/generate-stats.mjs

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("Missing GH_TOKEN / GITHUB_TOKEN");
  process.exit(1);
}

async function gql(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "trulynolan-profile-stats",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// --- account info + totals (as the authenticated viewer, so private counts) ---
const base = await gql(`query {
  viewer {
    name login createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
      totalCount nodes { stargazerCount }
    }
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection {
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
    }
  }
}`);

const v = base.viewer;
const stars = v.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
const prs = v.pullRequests.totalCount;
const issues = v.issues.totalCount;
const reviews = v.contributionsCollection.totalPullRequestReviewContributions;
const contributedTo = v.contributionsCollection.totalRepositoriesWithContributedCommits;
const followers = v.followers.totalCount;

// --- all-time commits incl. private, summed per contribution year ---
const startYear = new Date(v.createdAt).getUTCFullYear();
const nowYear = new Date().getUTCFullYear();
let commits = 0;
for (let y = startYear; y <= nowYear; y++) {
  const from = `${y}-01-01T00:00:00Z`;
  const to = `${y}-12-31T23:59:59Z`;
  const d = await gql(`query { viewer { contributionsCollection(from: "${from}", to: "${to}") {
    totalCommitContributions restrictedContributionsCount } } }`);
  const c = d.viewer.contributionsCollection;
  commits += c.totalCommitContributions + c.restrictedContributionsCount;
}

// --- rank (faithful github-readme-stats algorithm, all_commits = true) ---
const expCdf = (x) => 1 - 2 ** -x;
const logNormalCdf = (x) => x / (1 + x);
function calcRank() {
  const W = { commits: 2, prs: 3, issues: 1, reviews: 1, stars: 4, followers: 1 };
  const M = { commits: 1000, prs: 50, issues: 25, reviews: 2, stars: 50, followers: 10 };
  const total = W.commits + W.prs + W.issues + W.reviews + W.stars + W.followers;
  const rank =
    1 -
    (W.commits * expCdf(commits / M.commits) +
      W.prs * expCdf(prs / M.prs) +
      W.issues * expCdf(issues / M.issues) +
      W.reviews * expCdf(reviews / M.reviews) +
      W.stars * logNormalCdf(stars / M.stars) +
      W.followers * logNormalCdf(followers / M.followers)) /
      total;
  const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
  const pct = rank * 100;
  const level = LEVELS[THRESHOLDS.findIndex((t) => pct <= t)];
  return { level, percentile: pct };
}
const { level, percentile } = calcRank();

// --- tokyonight palette ---
const C = {
  title: "70a5fd",
  text: "a9b1d6",
  icon: "bf91f3",
  bg: "1a1b27",
  ring: "70a5fd",
};

const ICONS = {
  star: "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z",
  commit: "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z",
  pr: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
  issue: "M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z",
  repo: "M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z",
};

const rows = [
  { icon: "star", label: "Total Stars Earned", value: stars },
  { icon: "commit", label: `Total Commits (${startYear}-Present)`, value: commits },
  { icon: "pr", label: "Total PRs", value: prs },
  { icon: "issue", label: "Total Issues", value: issues },
  { icon: "repo", label: "Contributed to (last year)", value: contributedTo },
];

const fmt = (n) => n.toLocaleString("en-US");

const rowSvg = rows
  .map((r, i) => {
    const y = 0 + i * 25;
    return `
    <g transform="translate(0, ${y})">
      <svg x="0" y="0" viewBox="0 0 16 16" width="16" height="16" fill="#${C.icon}">
        <path fill-rule="evenodd" d="${ICONS[r.icon]}"/>
      </svg>
      <text x="25" y="12.5" fill="#${C.text}" font-size="14" font-weight="400">${r.label}:</text>
      <text x="220" y="12.5" fill="#${C.text}" font-size="14" font-weight="700">${fmt(r.value)}</text>
    </g>`;
  })
  .join("");

// rank ring geometry
const radius = 40;
const circumference = Math.PI * 2 * radius;
const progress = (percentile / 100) * circumference; // larger percentile = less filled
const offset = circumference - ((100 - percentile) / 100) * circumference;

const svg = `<svg width="495" height="195" viewBox="0 0 495 195" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${v.name || v.login} GitHub stats">
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${C.title}; }
    text { font-family: 'Segoe UI', Ubuntu, Sans-Serif; }
    .rank-text { font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${C.text}; }
  </style>
  <rect x="0.5" y="0.5" rx="6" height="99%" width="494" fill="#${C.bg}" stroke="#${C.bg}" stroke-opacity="1"/>
  <text x="25" y="35" class="header">${v.name || v.login}'s GitHub Stats</text>

  <g transform="translate(0, 0)">
    <g transform="translate(400, 105)">
      <circle cx="0" cy="0" r="${radius}" fill="none" stroke="#${C.text}" stroke-opacity="0.2" stroke-width="6"/>
      <circle cx="0" cy="0" r="${radius}" fill="none" stroke="#${C.ring}" stroke-width="6" stroke-linecap="round"
        transform="rotate(-90)"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"/>
      <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="rank-text">${level}</text>
    </g>
  </g>

  <g transform="translate(25, 55)">
    ${rowSvg}
  </g>
</svg>`;

const { writeFileSync } = await import("node:fs");
writeFileSync("assets/github-stats.svg", svg);
console.log(
  `Wrote assets/github-stats.svg\n  commits=${fmt(commits)} stars=${stars} prs=${prs} issues=${issues} reviews=${reviews} contributedTo=${contributedTo} rank=${level} (${percentile.toFixed(1)}%)`
);
