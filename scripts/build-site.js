const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function parseReleaseList(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(args.root || args._[0] || ".");
const topicsDir = path.join(repoRoot, "topics");
const releasesDir = path.join(repoRoot, "releases");
const siteDir = path.join(repoRoot, "site");
const selectedReleaseNames = parseReleaseList(args.releases || args.release || process.env.RELEASES);
const buildTimestamp = new Date().toISOString();
const defaultManifestFile = "admin-guide.yml";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return JSON.parse(trimmed.replace(/'/g, '"'));
  }
  return trimmed;
}

function parseYamlBlock(lines, startIndex, currentIndent) {
  const result = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const indent = line.match(/^ */)[0].length;
    if (indent < currentIndent) break;
    if (indent > currentIndent) throw new Error(`Unexpected indentation near: ${line}`);

    const trimmed = line.trim();
    const keyValue = trimmed.match(/^([^:]+):(.*)$/);
    if (!keyValue) throw new Error(`Unsupported YAML line: ${line}`);

    const key = keyValue[1].trim();
    const rest = keyValue[2].trim();

    if (!rest) {
      const nextLine = lines[index + 1] || "";
      const nextTrimmed = nextLine.trim();
      const nextIndent = nextLine.match(/^ */)[0].length;

      if (nextTrimmed.startsWith("- ")) {
        const listResult = [];
        index += 1;
        while (index < lines.length) {
          const listLine = lines[index];
          const listIndent = listLine.match(/^ */)[0].length;
          const listTrimmed = listLine.trim();
          if (!listTrimmed) {
            index += 1;
            continue;
          }
          if (listIndent < currentIndent + 2 || !listTrimmed.startsWith("- ")) break;

          const itemValue = listTrimmed.slice(2).trim();
          if (itemValue.includes(":")) {
            const item = {};
            const firstMatch = itemValue.match(/^([^:]+):(.*)$/);
            item[firstMatch[1].trim()] = parseScalar(firstMatch[2].trim());
            index += 1;
            while (index < lines.length) {
              const nestedLine = lines[index];
              const nestedIndent = nestedLine.match(/^ */)[0].length;
              const nestedTrimmed = nestedLine.trim();
              if (!nestedTrimmed) {
                index += 1;
                continue;
              }
              if (nestedIndent <= listIndent) break;
              const nestedMatch = nestedTrimmed.match(/^([^:]+):(.*)$/);
              item[nestedMatch[1].trim()] = parseScalar(nestedMatch[2].trim());
              index += 1;
            }
            listResult.push(item);
            continue;
          }

          listResult.push(parseScalar(itemValue));
          index += 1;
        }
        result[key] = listResult;
        continue;
      }

      if (nextIndent > currentIndent) {
        const nested = parseYamlBlock(lines, index + 1, currentIndent + 2);
        result[key] = nested.value;
        index = nested.nextIndex;
        continue;
      }

      result[key] = {};
      index += 1;
      continue;
    }

    result[key] = parseScalar(rest);
    index += 1;
  }

  return { value: result, nextIndex: index };
}

function parseYaml(source) {
  return parseYamlBlock(source.split("\n"), 0, 0).value;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter");
  return { frontmatter: parseYaml(match[1]), body: match[2].trim() };
}

function siteChrome(title, body, releaseLinks = []) {
  const switcher = releaseLinks
    .map((item) => `<a href="${item.href}"${item.active ? ' class="active"' : ""}>${escapeHtml(item.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #fffdf8;
      --canvas: #f4efe4;
      --ink: #1c2431;
      --muted: #5c677a;
      --line: #ddd2bd;
      --accent: #8a4b14;
      --accent-soft: #f2ddc5;
      --nav: #1e2f3f;
      --card: rgba(255, 251, 243, 0.84);
      --shadow: 0 18px 40px rgba(44, 54, 76, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.7), transparent 32%),
        linear-gradient(180deg, #f8f2e8 0%, var(--canvas) 100%);
    }
    header {
      background: linear-gradient(135deg, #213446 0%, var(--nav) 52%, #7d4417 160%);
      color: white;
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
    }
    .topbar {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    .switcher {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .switcher a {
      color: #f7ead8;
      text-decoration: none;
      padding: 6px 12px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.92rem;
    }
    .switcher a.active {
      background: rgba(255,255,255,0.16);
      color: white;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 20px 72px;
    }
    .hero, .panel, .topic-shell, .toc-shell, .guide-details {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 32px;
      position: relative;
      overflow: hidden;
      margin-bottom: 26px;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -60px -60px auto;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(138,75,20,0.14), transparent 65%);
      pointer-events: none;
    }
    .eyebrow, .meta, .breadcrumbs, footer {
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.78rem;
      margin-bottom: 8px;
    }
    h1, h2, h3 {
      margin: 0 0 12px;
      line-height: 1.08;
      font-weight: 700;
    }
    h1 { font-size: clamp(2.25rem, 4vw, 4rem); }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.16rem; }
    p {
      margin: 0 0 14px;
      line-height: 1.72;
      font-size: 1.04rem;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 12px;
      background: var(--accent-soft);
      color: #68370d;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.88rem;
      font-weight: 600;
    }
    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: minmax(0, 1.9fr) minmax(260px, 0.9fr);
    }
    .release-list {
      display: grid;
      gap: 16px;
    }
    .release-card, .section-card, .panel, .topic-shell, .toc-shell {
      padding: 24px;
    }
    .release-card, .section-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: var(--shadow);
    }
    .release-card a, .section-card a, .breadcrumbs a, .topic-nav a {
      color: var(--accent);
      text-decoration: none;
    }
    .release-card p:last-child, .section-card p:last-child, .panel p:last-child {
      margin-bottom: 0;
    }
    table {
      width: 100%;
      margin: 18px 0;
      border-collapse: collapse;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.95rem;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #efe6d7;
      color: var(--ink);
    }
    ul, ol {
      margin: 0 0 16px;
      padding-left: 24px;
      line-height: 1.7;
    }
    li { margin-bottom: 8px; }
    .section-card ul { margin-top: 14px; }
    .topic-shell {
      padding: 28px 30px;
      max-width: 860px;
      margin: 0 auto;
    }
    .toc-shell {
      background: rgba(255, 251, 243, 0.92);
    }
    .toc-shell h2 {
      margin-bottom: 18px;
    }
    .toc-section + .toc-section {
      margin-top: 26px;
      padding-top: 22px;
      border-top: 1px solid var(--line);
    }
    .toc-section-title {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.78rem;
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      margin-bottom: 10px;
    }
    .toc-list {
      margin: 0;
      padding-left: 24px;
    }
    .toc-list li {
      margin-bottom: 16px;
    }
    .toc-entry-title {
      display: inline-block;
      margin-bottom: 4px;
      font-size: 1.08rem;
      font-weight: 700;
      color: var(--accent);
      text-decoration: none;
    }
    .toc-entry-meta {
      display: block;
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.9rem;
      margin-top: 4px;
    }
    .toc-entry-summary {
      margin: 6px 0 0;
      color: var(--ink);
      font-size: 0.98rem;
      line-height: 1.6;
    }
    .guide-list {
      display: grid;
      gap: 14px;
    }
    .guide-details {
      overflow: hidden;
      background: rgba(255, 251, 243, 0.92);
    }
    .guide-details summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 22px 24px;
      cursor: pointer;
      list-style: none;
    }
    .guide-details summary::-webkit-details-marker {
      display: none;
    }
    .guide-details summary::after {
      content: "+";
      flex: 0 0 auto;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      color: var(--accent);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 1.25rem;
      line-height: 1;
    }
    .guide-details[open] summary::after {
      content: "-";
    }
    .guide-title {
      display: block;
      margin-bottom: 4px;
      font-size: 1.35rem;
      font-weight: 700;
    }
    .guide-meta {
      display: block;
      color: var(--muted);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.92rem;
    }
    .guide-body {
      padding: 0 24px 24px;
      border-top: 1px solid var(--line);
    }
    .guide-body .toc-section:first-child {
      margin-top: 22px;
    }
    .meta-grid {
      display: grid;
      gap: 10px 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 20px 0 8px;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255, 249, 239, 0.92);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      font-size: 0.94rem;
    }
    .meta-item strong {
      display: block;
      margin-bottom: 3px;
      color: var(--muted);
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .topic-shell h1 { font-size: clamp(2rem, 3vw, 3.2rem); }
    .topic-shell h2 { margin-top: 28px; }
    .topic-shell h3 { margin-top: 22px; }
    .topic-nav {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }
    .topic-nav a {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
    }
    code {
      background: #efe6d7;
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 0.95em;
    }
    footer {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 20px 26px;
      font-size: 0.9rem;
    }
    @media (max-width: 800px) {
      .grid { grid-template-columns: 1fr; }
      .hero, .release-card, .section-card, .panel, .topic-shell, .toc-shell { padding: 22px; }
      .guide-details summary { align-items: flex-start; padding: 20px; }
      .guide-body { padding: 0 20px 20px; }
      .topic-nav { flex-direction: column; }
      .meta-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div class="brand">Network Docs</div>
      <nav class="switcher">${switcher}</nav>
    </div>
  </header>
  ${body}
  <footer>Generated from <code>${escapeHtml(path.basename(repoRoot))}</code> at <code>${escapeHtml(buildTimestamp)}</code>.</footer>
</body>
</html>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let listType = null;
  let table = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    html.push(listType === "ol" ? "</ol>" : "</ul>");
    listType = null;
  }

  function parseTableRow(value) {
    return value
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function isTableDivider(value) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(value.trim());
  }

  function isTableRow(value) {
    return /^\|.+\|$/.test(value.trim());
  }

  function flushTable() {
    if (!table) return;
    const head = table.headers
      .map((cell) => `<th>${inlineMarkdownToHtml(cell)}</th>`)
      .join("");
    const rows = table.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdownToHtml(cell)}</td>`).join("")}</tr>`)
      .join("\n");
    html.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`);
    table = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      flushTable();
      continue;
    }

    if (isTableRow(trimmed)) {
      const nextLine = lines[index + 1] || "";
      if (!table && isTableDivider(nextLine)) {
        flushParagraph();
        closeList();
        table = { headers: parseTableRow(trimmed), rows: [] };
        index += 1;
        continue;
      }
      if (table) {
        table.rows.push(parseTableRow(trimmed));
        continue;
      }
    }

    flushTable();

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdownToHtml(ordered[1])}</li>`);
      continue;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdownToHtml(unordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  flushTable();
  return html.join("\n");
}

function loadTopics() {
  const topics = new Map();
  for (const fileName of fs.readdirSync(topicsDir)) {
    if (!fileName.endsWith(".md")) continue;
    const fullPath = path.join(topicsDir, fileName);
    const { frontmatter, body } = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
    topics.set(frontmatter.topic_id, {
      slug: fileName.replace(/\.md$/, ""),
      topicId: frontmatter.topic_id,
      title: frontmatter.title,
      shortTitle: frontmatter.short_title || frontmatter.title,
      summary: frontmatter.summary || "",
      product: frontmatter.product || "",
      platform: frontmatter.platform || "",
      contentType: frontmatter.content_type || "",
      audience: frontmatter.audience || [],
      estimatedTime: frontmatter.estimated_time || "",
      permissions: frontmatter.permissions || [],
      tags: frontmatter.tags || [],
      owner: frontmatter.owner || "",
      lastReviewed: frontmatter.last_reviewed || "",
      lifecycle: frontmatter.lifecycle || {},
      body,
    });
  }
  return topics;
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

function releaseMatchesRange(release, range) {
  if (range.endsWith("+")) return compareVersions(release, range.slice(0, -1)) >= 0;
  if (range.includes("-")) {
    const [start, end] = range.split("-");
    return compareVersions(release, start) >= 0 && compareVersions(release, end) <= 0;
  }
  return release === range;
}

function renderVersionBlocks(markdown, release) {
  return markdown
    .replace(/:::version range="([^"]+)"\n([\s\S]*?)\n:::/g, (_match, range, content) => {
      return releaseMatchesRange(release, range) ? content.trim() : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function releaseMatchesTopic(release, topic) {
  return (topic.lifecycle.applies_to || []).includes(release);
}

function topicIdsFromSections(sections) {
  return sections.flatMap((section) => section.topics || []);
}

function manifestFilesForRelease(releaseRoot) {
  const manifestsDir = path.join(releaseRoot, "manifests");
  return fs.readdirSync(manifestsDir)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    .sort((left, right) => {
      if (left === defaultManifestFile) return -1;
      if (right === defaultManifestFile) return 1;
      return left.localeCompare(right);
    });
}

function loadReleaseConfig(releaseName) {
  const releaseRoot = path.join(releasesDir, releaseName);
  const guides = manifestFilesForRelease(releaseRoot).map((manifestFile) => {
    const manifest = parseYaml(fs.readFileSync(path.join(releaseRoot, "manifests", manifestFile), "utf8"));
    return {
      manifestFile,
      isDefault: manifestFile === defaultManifestFile,
      bookId: manifest.book_id || manifestFile.replace(/\.(ya?ml)$/, ""),
      manifest,
    };
  });

  return {
    releaseName,
    guides,
    metadata: parseYaml(fs.readFileSync(path.join(releaseRoot, "assets", "release-metadata.yml"), "utf8")),
  };
}

function normalizePublishPath(release) {
  const rawPath = release.metadata.publish_path || `/${release.releaseName}/`;
  const trimmedPath = rawPath.replace(/^\/+|\/+$/g, "");
  return trimmedPath ? `/${trimmedPath}/` : "/";
}

function publishDirPath(release) {
  const normalized = normalizePublishPath(release).replace(/^\/|\/$/g, "");
  return normalized || ".";
}

function releaseIndexPath(release) {
  return guideIndexPath(release, defaultGuide(release));
}

function defaultGuide(release) {
  return release.guides.find((guide) => guide.isDefault) || release.guides[0];
}

function guideDirPath(release, guide) {
  const releaseDir = publishDirPath(release);
  if (guide.isDefault) return releaseDir;
  return releaseDir === "." ? guide.bookId : `${releaseDir}/${guide.bookId}`;
}

function guideIndexPath(release, guide) {
  const dirPath = guideDirPath(release, guide);
  return dirPath === "." ? "index.html" : `${dirPath}/index.html`;
}

function topicPathForGuide(release, guide, topic) {
  const dirPath = guideDirPath(release, guide);
  return dirPath === "." ? `${topic.slug}.html` : `${dirPath}/${topic.slug}.html`;
}

function hrefFromDir(fromDir, targetPath) {
  const relative = path.posix.relative(fromDir === "." ? "" : fromDir, targetPath);
  if (!relative) return "./index.html";
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function outputDirForRelease(release) {
  const dirPath = publishDirPath(release);
  return dirPath === "." ? siteDir : path.join(siteDir, ...dirPath.split("/"));
}

function outputDirForGuide(release, guide) {
  const dirPath = guideDirPath(release, guide);
  return dirPath === "." ? siteDir : path.join(siteDir, ...dirPath.split("/"));
}

function buildReleaseNav(releases, fromDir = "", activeRelease = null) {
  return releases.map((release) => ({
    label: release.metadata.release,
    href: hrefFromDir(fromDir, releaseIndexPath(release)),
    active: activeRelease ? release.releaseName === activeRelease.releaseName : false,
  }));
}

function buildGuideLinks(release, activeGuide, fromDir) {
  return release.guides.map((guide) => ({
    label: guide.manifest.title,
    href: hrefFromDir(fromDir, guideIndexPath(release, guide)),
    active: guide.bookId === activeGuide.bookId,
  }));
}

function renderHomePage(releases) {
  const cards = releases.map((release) => {
    const latest = release.metadata.latest ? '<span class="pill">Latest release</span>' : "";
    const guideLinks = release.guides
      .map((guide) => `<a href="${hrefFromDir("", guideIndexPath(release, guide))}">${escapeHtml(guide.manifest.title)}</a>`)
      .join(", ");
    return `
      <article class="release-card">
        <div class="eyebrow">Release package</div>
        <h2><a href="${hrefFromDir("", releaseIndexPath(release))}">${escapeHtml(release.metadata.display_name)}</a></h2>
        <p>Publish path: <code>${escapeHtml(release.metadata.publish_path)}</code></p>
        <p>Status: <strong>${escapeHtml(release.metadata.status)}</strong></p>
        <p>Guides: ${guideLinks}</p>
        <div class="pill-row">${latest}</div>
      </article>
    `;
  }).join("");

  return siteChrome(
    "Network Docs Releases",
    `
    <main>
      <section class="hero">
        <div class="eyebrow">Production publishing model</div>
        <h1>Release packages built from canonical content</h1>
        <p>This site demonstrates the production Option 2 model: canonical topics live in a content repo, while release manifests and navigation live in a separate releases repo.</p>
        <div class="pill-row">
          <span class="pill">${releases.length} release packages</span>
          <span class="pill">Folder-based release management</span>
        </div>
      </section>
      <section class="release-list">
        ${cards}
      </section>
    </main>`,
    buildReleaseNav(releases)
  );
}

function renderTocSections(sections, topicHref) {
  return sections.map((section) => `
    <section class="toc-section">
      <div class="toc-section-title">${escapeHtml(section.title)}</div>
      <ol class="toc-list">
        ${section.topics.map((topic) => `
          <li>
            <a class="toc-entry-title" href="${topicHref(topic)}">${escapeHtml(topic.title)}</a>
            <span class="toc-entry-meta">${escapeHtml(topic.contentType || "task")} · ${escapeHtml(topic.estimatedTime || "Estimated time not set")}</span>
            ${topic.summary ? `<p class="toc-entry-summary">${escapeHtml(topic.summary)}</p>` : ""}
          </li>
        `).join("")}
      </ol>
    </section>
  `).join("");
}

function renderGuidePage(release, guide, sections, releaseLinks, guideLinks) {
  const tocMarkup = renderTocSections(sections, (topic) => `./${topic.slug}.html`);
  const guideLinksMarkup = guideLinks.length > 1
    ? `<p><strong>Guides:</strong> ${guideLinks.map((item) => item.active
      ? `<strong>${escapeHtml(item.label)}</strong>`
      : `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join(", ")}</p>`
    : "";

  return siteChrome(
    `${guide.manifest.title} · ${release.metadata.display_name}`,
    `
    <main>
      <section class="hero">
        <div class="eyebrow">Release package</div>
        <h1>${escapeHtml(release.metadata.display_name)}</h1>
        <p>Use the ${escapeHtml(guide.manifest.title)} to configure, secure, upgrade, and maintain routers for ${escapeHtml(release.metadata.display_name)}.</p>
        <div class="pill-row">
          <span class="pill">Path ${escapeHtml(release.metadata.publish_path)}</span>
          <span class="pill">${escapeHtml(release.metadata.status)}</span>
          ${release.metadata.latest ? '<span class="pill">Latest</span>' : ""}
        </div>
      </section>
      <section class="grid">
        <section class="toc-shell">
          <div class="eyebrow">Table of contents</div>
          <h2>${escapeHtml(guide.manifest.title)}</h2>
          ${tocMarkup}
        </section>
        <aside class="panel">
          <div class="eyebrow">Release facts</div>
          <h2>Build summary</h2>
          <p>Topics are filtered by canonical lifecycle metadata before being placed into the release navigation.</p>
          <p><strong>Release:</strong> ${escapeHtml(release.metadata.release)}</p>
          <p><strong>Guide:</strong> ${escapeHtml(guide.bookId)}</p>
          <p><strong>Publish path:</strong> <code>${escapeHtml(release.metadata.publish_path)}</code></p>
          <p><strong>Sections:</strong> ${sections.length}</p>
          ${guideLinksMarkup}
        </aside>
      </section>
    </main>`,
    releaseLinks
  );
}

function renderGuideAccordion(release, guide, sections, fromDir) {
  const sectionCount = sections.length;
  const topicCount = sections.reduce((count, section) => count + section.topics.length, 0);
  const tocMarkup = renderTocSections(sections, (topic) => hrefFromDir(fromDir, topicPathForGuide(release, guide, topic)));
  return `
    <details class="guide-details">
      <summary>
        <span>
          <span class="guide-title">${escapeHtml(guide.manifest.title)}</span>
          <span class="guide-meta">${sectionCount} section${sectionCount === 1 ? "" : "s"} · ${topicCount} topic${topicCount === 1 ? "" : "s"}</span>
        </span>
      </summary>
      <div class="guide-body">
        ${tocMarkup}
      </div>
    </details>
  `;
}

function renderReleasePage(release, guideOutputs, releaseLinks) {
  const fromDir = publishDirPath(release);
  const guidesMarkup = guideOutputs
    .map(({ guide, sections }) => renderGuideAccordion(release, guide, sections, fromDir))
    .join("");

  return siteChrome(
    `${release.metadata.display_name} Guides`,
    `
    <main>
      <section class="hero">
        <div class="eyebrow">Release package</div>
        <h1>${escapeHtml(release.metadata.display_name)}</h1>
        <p>Select a guide to expand its topics for ${escapeHtml(release.metadata.display_name)}.</p>
        <div class="pill-row">
          <span class="pill">Path ${escapeHtml(release.metadata.publish_path)}</span>
          <span class="pill">${escapeHtml(release.metadata.status)}</span>
          ${release.metadata.latest ? '<span class="pill">Latest</span>' : ""}
        </div>
      </section>
      <section class="guide-list">
        ${guidesMarkup}
      </section>
    </main>`,
    releaseLinks
  );
}

function renderTopicPage(topic, release, guide, releaseLinks, nav) {
  const breadcrumbLabel = guide.isDefault ? release.metadata.display_name : guide.manifest.title;
  const metaItems = [
    ["Product", topic.product],
    ["Platform", topic.platform],
    ["Audience", Array.isArray(topic.audience) ? topic.audience.join(", ") : topic.audience],
    ["Estimated time", topic.estimatedTime],
    ["Permissions", Array.isArray(topic.permissions) ? topic.permissions.join(", ") : topic.permissions],
    ["Last reviewed", topic.lastReviewed],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="meta-item"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`)
    .join("");

  const topicNav = (nav.previous || nav.next)
    ? `<nav class="topic-nav">
        <div>${nav.previous ? `<a href="./${nav.previous.slug}.html"><span>Previous</span><strong>${escapeHtml(nav.previous.title)}</strong></a>` : ""}</div>
        <div>${nav.next ? `<a href="./${nav.next.slug}.html"><span>Next</span><strong>${escapeHtml(nav.next.title)}</strong></a>` : ""}</div>
      </nav>`
    : "";

  return siteChrome(
    `${topic.title} · ${guide.manifest.title} · ${release.metadata.display_name}`,
    `
    <main>
      <div class="topic-shell">
        <div class="breadcrumbs"><a href="./index.html">${escapeHtml(breadcrumbLabel)}</a> · ${escapeHtml(guide.manifest.title)} · Topic ID <code>${escapeHtml(topic.topicId)}</code></div>
        ${topic.summary ? `<p>${escapeHtml(topic.summary)}</p>` : ""}
        ${metaItems ? `<div class="meta-grid">${metaItems}</div>` : ""}
        ${markdownToHtml(renderVersionBlocks(topic.body, release.releaseName))}
        ${topicNav}
      </div>
    </main>`,
    releaseLinks
  );
}

function buildGuide(topics, release, guide, releases) {
  const outputDir = outputDirForGuide(release, guide);
  ensureDir(outputDir);

  const manifestSections = guide.manifest.sections || [];
  const included = [];
  const includedTopicIds = new Set();
  for (const topicId of topicIdsFromSections(manifestSections)) {
    if (includedTopicIds.has(topicId)) continue;
    const topic = topics.get(topicId);
    if (!topic) continue;
    if (!releaseMatchesTopic(release.releaseName, topic)) continue;
    included.push(topic);
    includedTopicIds.add(topicId);
  }

  const sections = manifestSections
    .map((section) => {
      const sectionTopics = (section.topics || [])
        .map((topicId) => included.find((topic) => topic.topicId === topicId))
        .filter(Boolean)
        .map((topic) => ({
          slug: topic.slug,
          title: topic.title,
          topicId: topic.topicId,
          summary: topic.summary,
          contentType: topic.contentType,
          estimatedTime: topic.estimatedTime,
        }));
      if (sectionTopics.length === 0) return null;
      return { title: section.title, topics: sectionTopics };
    })
    .filter(Boolean);

  const fromDir = guideDirPath(release, guide);
  const releaseLinks = buildReleaseNav(releases, fromDir, release);
  const guideLinks = buildGuideLinks(release, guide, fromDir);
  const orderedTopics = sections.flatMap((section) => section.topics);

  for (const [index, orderedTopic] of orderedTopics.entries()) {
    const topic = included.find((item) => item.topicId === orderedTopic.topicId);
    const previous = index > 0 ? orderedTopics[index - 1] : null;
    const next = index < orderedTopics.length - 1 ? orderedTopics[index + 1] : null;
    fs.writeFileSync(
      path.join(outputDir, `${topic.slug}.html`),
      renderTopicPage(topic, release, guide, releaseLinks, { previous, next })
    );
  }

  if (!guide.isDefault) {
    fs.writeFileSync(path.join(outputDir, "index.html"), renderGuidePage(release, guide, sections, releaseLinks, guideLinks));
  }

  return { guide, sections };
}

function buildRelease(topics, release, releases) {
  const guideOutputs = release.guides.map((guide) => buildGuide(topics, release, guide, releases));
  const releaseDir = outputDirForGuide(release, defaultGuide(release));
  const releaseLinks = buildReleaseNav(releases, publishDirPath(release), release);
  fs.writeFileSync(path.join(releaseDir, "index.html"), renderReleasePage(release, guideOutputs, releaseLinks));
}

function main() {
  const allReleases = fs.readdirSync(releasesDir)
    .filter((entryName) => fs.statSync(path.join(releasesDir, entryName)).isDirectory())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(loadReleaseConfig);

  const selectedSet = new Set(selectedReleaseNames);
  const unknownReleases = selectedReleaseNames.filter((releaseName) => !allReleases.some((release) => release.releaseName === releaseName));
  if (unknownReleases.length > 0) {
    console.error(`Unknown release output(s): ${unknownReleases.join(", ")}`);
    process.exit(1);
  }

  const releasesToBuild = selectedReleaseNames.length > 0
    ? allReleases.filter((release) => selectedSet.has(release.releaseName))
    : allReleases;

  if (selectedReleaseNames.length === 0) {
    removeDir(siteDir);
  } else {
    for (const release of releasesToBuild) {
      removeDir(outputDirForRelease(release));
    }
  }
  ensureDir(siteDir);

  const topics = loadTopics();

  for (const release of releasesToBuild) {
    buildRelease(topics, release, allReleases);
  }

  fs.writeFileSync(path.join(siteDir, "index.html"), renderHomePage(allReleases));
  fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");
  console.log(`Built ${releasesToBuild.length} release output(s): ${releasesToBuild.map((release) => release.releaseName).join(", ") || "none"}`);
}

main();
