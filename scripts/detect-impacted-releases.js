const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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
  return parseYamlBlock(source.split("\n"), 0, 0).value;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter");
  return parseYaml(match[1]);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function readChangedFiles(args, repoRoot) {
  const files = [];

  for (const value of args.files || []) {
    files.push(...value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean));
  }

  if (args["changed-files"]) {
    files.push(...fs.readFileSync(path.resolve(repoRoot, args["changed-files"]), "utf8").split(/\r?\n/).filter(Boolean));
  }

  if (args.base && args.head) {
    const output = execFileSync("git", ["diff", "--name-only", args.base, args.head], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    files.push(...output.split(/\r?\n/).filter(Boolean));
  }

  if (files.length === 0 && process.env.GITHUB_EVENT_BEFORE && process.env.GITHUB_SHA) {
    const output = execFileSync("git", ["diff", "--name-only", process.env.GITHUB_EVENT_BEFORE, process.env.GITHUB_SHA], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    files.push(...output.split(/\r?\n/).filter(Boolean));
  }

  return [...new Set(files.map(normalizePath))].sort();
}

function loadTopics(repoRoot) {
  const topicsDir = path.join(repoRoot, "topics");
  const topics = new Map();

  if (!fs.existsSync(topicsDir)) return topics;
  for (const fileName of fs.readdirSync(topicsDir).filter((name) => name.endsWith(".md"))) {
    const relativePath = normalizePath(path.join("topics", fileName));
    const fullPath = path.join(topicsDir, fileName);
    const frontmatter = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
    topics.set(relativePath, {
      path: relativePath,
      topicId: frontmatter.topic_id,
      appliesTo: frontmatter.lifecycle?.applies_to || [],
    });
  }

  return topics;
}

function topicIdsFromSections(sections) {
  return sections.flatMap((section) => section.topics || []);
}

function manifestFilesForRelease(releaseRoot) {
  const manifestsDir = path.join(releaseRoot, "manifests");
  if (!fs.existsSync(manifestsDir)) return [];
  return fs.readdirSync(manifestsDir)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"));
}

function readReleaseMetadata(releaseRoot) {
  const metadataPath = path.join(releaseRoot, "assets", "release-metadata.yml");
  if (!fs.existsSync(metadataPath)) return {};
  return parseYaml(fs.readFileSync(metadataPath, "utf8"));
}

function releasePublishEnabled(metadata) {
  return metadata.publish !== false;
}

function loadReleases(repoRoot) {
  const releasesDir = path.join(repoRoot, "releases");
  if (!fs.existsSync(releasesDir)) return [];

  return fs.readdirSync(releasesDir)
    .filter((entryName) => fs.statSync(path.join(releasesDir, entryName)).isDirectory())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((releaseName) => {
      const releaseRoot = path.join(releasesDir, releaseName);
      const metadata = readReleaseMetadata(releaseRoot);
      const topicIds = manifestFilesForRelease(releaseRoot)
        .flatMap((manifestFile) => {
          const manifestPath = path.join(releaseRoot, "manifests", manifestFile);
          const manifest = parseYaml(fs.readFileSync(manifestPath, "utf8"));
          return topicIdsFromSections(manifest.sections || []);
        });
      return {
        releaseName,
        publishEnabled: releasePublishEnabled(metadata),
        topics: new Set(topicIds),
      };
    });
}

function allReleaseNames(releases) {
  return releases
    .filter((release) => release.publishEnabled)
    .map((release) => release.releaseName);
}

function releaseMetadataPath(releaseName) {
  return `releases/${releaseName}/assets/release-metadata.yml`;
}

function readBaseReleasePublishEnabled(args, repoRoot, releaseName) {
  if (!args.base) return null;

  try {
    const source = execFileSync("git", ["show", `${args.base}:${releaseMetadataPath(releaseName)}`], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return releasePublishEnabled(parseYaml(source));
  } catch (_error) {
    return false;
  }
}

function publishGateChanged(args, repoRoot, release) {
  const basePublishEnabled = readBaseReleasePublishEnabled(args, repoRoot, release.releaseName);
  return basePublishEnabled !== null && basePublishEnabled !== release.publishEnabled;
}

function impactedReleasesForTopic(topic, releases) {
  return releases
    .filter((release) => release.publishEnabled)
    .filter((release) => release.topics.has(topic.topicId))
    .filter((release) => topic.appliesTo.includes(release.releaseName))
    .map((release) => release.releaseName);
}

function detectImpacts(changedFiles, topics, releases, args, repoRoot) {
  const impacted = new Set();
  const allReleases = allReleaseNames(releases);

  for (const filePath of changedFiles) {
    if (filePath.startsWith("releases/")) {
      const [, releaseName] = filePath.split("/");
      const release = releases.find((candidate) => candidate.releaseName === releaseName);
      if (release) {
        if (filePath === releaseMetadataPath(releaseName) && publishGateChanged(args, repoRoot, release)) {
          allReleases.forEach((publishedReleaseName) => impacted.add(publishedReleaseName));
        } else if (release.publishEnabled) {
          impacted.add(releaseName);
        }
      } else {
        allReleases.forEach((publishedReleaseName) => impacted.add(publishedReleaseName));
      }
      continue;
    }

    if (filePath.startsWith("topics/")) {
      const topic = topics.get(filePath);
      if (!topic || !topic.topicId) {
        allReleases.forEach((releaseName) => impacted.add(releaseName));
        continue;
      }
      impactedReleasesForTopic(topic, releases).forEach((releaseName) => impacted.add(releaseName));
      continue;
    }

    if (
      filePath.startsWith("snippets/") ||
      filePath.startsWith("templates/") ||
      filePath.startsWith("schemas/") ||
      filePath === "package.json" ||
      filePath.startsWith("scripts/") ||
      filePath.startsWith(".github/workflows/")
    ) {
      allReleases.forEach((releaseName) => impacted.add(releaseName));
    }
  }

  return [...impacted].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function writeGitHubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root || args._[0] || ".");
  const topics = loadTopics(repoRoot);
  const releases = loadReleases(repoRoot);
  const changedFiles = args.all ? ["scripts/build-site.js"] : readChangedFiles(args, repoRoot);
  const impacted = args.all ? allReleaseNames(releases) : detectImpacts(changedFiles, topics, releases, args, repoRoot);
  const impactedCsv = impacted.join(",");

  writeGitHubOutput({
    impacted_releases: impactedCsv,
    release_matrix: JSON.stringify(impacted),
    has_impacts: impacted.length > 0 ? "true" : "false",
  });

  if (args.json) {
    console.log(JSON.stringify({ changedFiles, impactedReleases: impacted }, null, 2));
    return;
  }

  console.log(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "(none)"}`);
  console.log(`Impacted release outputs: ${impactedCsv || "(none)"}`);
}

main();
