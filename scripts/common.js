const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const defaultManifestFile = "admin-guide.yml";

function parseArgs(argv) {
  const args = { _: [], files: [] };
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

    if (key === "files") {
      args.files.push(next);
    } else {
      args[key] = next;
    }
    index += 1;
  }
  return args;
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
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
            if (!firstMatch) throw new Error(`Unsupported YAML list item: ${listLine}`);
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
              if (!nestedMatch) throw new Error(`Unsupported YAML line: ${nestedLine}`);
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
  return parseYamlBlock(String(source).split(/\r?\n/), 0, 0).value;
}

function readYaml(filePath) {
  return parseYaml(fs.readFileSync(filePath, "utf8"));
}

function parseTopicDocument(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter");
  return {
    frontmatter: parseYaml(match[1]),
    body: match[2].trim(),
    bodyStartLine: match[1].split(/\r?\n/).length + 3,
  };
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function listDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((entryName) => fs.statSync(path.join(dirPath, entryName)).isDirectory())
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function manifestFilesForRelease(releaseRoot) {
  const manifestsDir = path.join(releaseRoot, "manifests");
  if (!fs.existsSync(manifestsDir)) return [];
  return fs.readdirSync(manifestsDir)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    .sort((left, right) => {
      if (left === defaultManifestFile) return -1;
      if (right === defaultManifestFile) return 1;
      return left.localeCompare(right);
    });
}

function loadReleases(repoRoot) {
  const releasesDir = path.join(repoRoot, "releases");
  return listDirectories(releasesDir).map((releaseName, index) => {
    const releaseRoot = path.join(releasesDir, releaseName);
    const metadataPath = path.join(releaseRoot, "assets", "release-metadata.yml");
    const metadata = readYaml(metadataPath);
    const guides = manifestFilesForRelease(releaseRoot).map((manifestFile) => {
      const manifestPath = path.join(releaseRoot, "manifests", manifestFile);
      const manifest = readYaml(manifestPath);
      return {
        manifestFile,
        manifestPath,
        isDefault: manifestFile === defaultManifestFile,
        bookId: manifest.book_id || manifestFile.replace(/\.(ya?ml)$/, ""),
        manifest,
      };
    });

    return {
      releaseName,
      releaseRoot,
      metadataPath,
      metadata,
      order: Number.isFinite(Number(metadata.order)) ? Number(metadata.order) : index,
      guides,
    };
  }).sort((left, right) => left.order - right.order || left.releaseName.localeCompare(right.releaseName, undefined, { numeric: true }));
}

function loadContentModel(repoRoot) {
  const releases = loadReleases(repoRoot);
  return {
    repoRoot,
    topicsDir: path.join(repoRoot, "topics"),
    releasesDir: path.join(repoRoot, "releases"),
    releases,
    releaseMap: new Map(releases.map((release) => [release.releaseName, release])),
  };
}

function loadTopics(repoRoot) {
  const topicsDir = path.join(repoRoot, "topics");
  const topics = new Map();
  if (!fs.existsSync(topicsDir)) return topics;

  for (const fileName of fs.readdirSync(topicsDir).filter((name) => name.endsWith(".md")).sort()) {
    const fullPath = path.join(topicsDir, fileName);
    const topicDocument = parseTopicDocument(fs.readFileSync(fullPath, "utf8"));
    const topicId = topicDocument.frontmatter.topic_id;
    if (!topicId) continue;

    topics.set(topicId, {
      ...topicDocument,
      fileName,
      path: fullPath,
      relativePath: normalizePath(path.relative(repoRoot, fullPath)),
      topicId,
      slug: fileName.replace(/\.md$/, ""),
      title: topicDocument.frontmatter.title || topicId,
      summary: topicDocument.frontmatter.summary || "",
      contentType: topicDocument.frontmatter.content_type || "",
      lifecycle: topicDocument.frontmatter.lifecycle || {},
      retrieval: topicDocument.frontmatter.retrieval || {},
    });
  }

  return topics;
}

function topicIdsFromSections(sections) {
  return (sections || []).flatMap((section) => section.topics || []);
}

function releaseById(model, releaseId) {
  return model.releaseMap.get(releaseId) || null;
}

function lifecycleAppliesToRelease(model, lifecycle, release) {
  const appliesTo = lifecycle?.applies_to;

  if (Array.isArray(appliesTo)) {
    return appliesTo.includes(release.releaseName);
  }

  if (appliesTo && typeof appliesTo === "object") {
    if (appliesTo.only) return release.releaseName === appliesTo.only;
    if (Array.isArray(appliesTo.except) && appliesTo.except.includes(release.releaseName)) return false;

    const fromId = appliesTo.from || lifecycle.introduced_in;
    if (fromId) {
      const from = releaseById(model, fromId);
      if (!from || release.order < from.order) return false;
    }

    if (appliesTo.until) {
      const until = releaseById(model, appliesTo.until);
      if (!until || release.order > until.order) return false;
    }

    if (lifecycle.removed_in) {
      const removed = releaseById(model, lifecycle.removed_in);
      if (removed && release.order >= removed.order) return false;
    }

    return true;
  }

  if (lifecycle?.introduced_in) {
    const introduced = releaseById(model, lifecycle.introduced_in);
    if (!introduced || release.order < introduced.order) return false;
    if (lifecycle.removed_in) {
      const removed = releaseById(model, lifecycle.removed_in);
      if (removed && release.order >= removed.order) return false;
    }
    return true;
  }

  return false;
}

function applicableReleaseNames(model, topic) {
  return model.releases
    .filter((release) => lifecycleAppliesToRelease(model, topic.lifecycle, release))
    .map((release) => release.releaseName);
}

function releaseAcceptsUpdates(release) {
  return release.metadata.publish !== false;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeTopicBody(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function topicRenderedContentHash(topic) {
  return sha256(JSON.stringify({
    title: topic.title || "",
    summary: topic.summary || "",
    content_type: topic.contentType || "",
    body: normalizeTopicBody(topic.body),
  }));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

module.exports = {
  applicableReleaseNames,
  defaultManifestFile,
  lifecycleAppliesToRelease,
  loadContentModel,
  loadReleases,
  loadTopics,
  normalizePath,
  parseArgs,
  parseTopicDocument,
  readYaml,
  releaseAcceptsUpdates,
  releaseById,
  slugify,
  topicIdsFromSections,
  topicRenderedContentHash,
};
