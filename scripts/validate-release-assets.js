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

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(args.root || args._[0] || ".");
const topicsDir = path.join(repoRoot, "topics");
const releasesDir = path.join(repoRoot, "releases");
const topicIdPattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-(TASK|CONCEPT|REFERENCE)-\d{3}$/;
const sectionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const bookIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = "\\d+(?:\\.\\d+)+";
const defaultManifestFile = "admin-guide.yml";

function relative(filePath) {
  return path.relative(process.cwd(), filePath) || ".";
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

function parseTopicDocument(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter");
  return {
    frontmatter: parseYaml(match[1]),
    body: match[2],
    bodyStartLine: match[1].split(/\r?\n/).length + 3,
  };
}

function readYaml(filePath) {
  return parseYaml(fs.readFileSync(filePath, "utf8"));
}

function loadTopics(issues) {
  const topics = new Map();

  if (!fs.existsSync(topicsDir)) {
    issues.push(`content topics directory not found: ${relative(topicsDir)}`);
    return topics;
  }

  const topicFiles = fs.readdirSync(topicsDir).filter((fileName) => fileName.endsWith(".md")).sort();
  for (const fileName of topicFiles) {
    const fullPath = path.join(topicsDir, fileName);
    let frontmatter;
    let body;
    let bodyStartLine;
    try {
      const topicDocument = parseTopicDocument(fs.readFileSync(fullPath, "utf8"));
      frontmatter = topicDocument.frontmatter;
      body = topicDocument.body;
      bodyStartLine = topicDocument.bodyStartLine;
    } catch (error) {
      issues.push(`${relative(fullPath)}: ${error.message}`);
      continue;
    }

    const topicId = frontmatter.topic_id;
    if (!topicId) {
      issues.push(`${relative(fullPath)}: missing topic_id`);
      continue;
    }
    if (!topicIdPattern.test(topicId)) {
      issues.push(`${relative(fullPath)}: invalid topic_id format "${topicId}"`);
    }
    if (topics.has(topicId)) {
      issues.push(`${relative(fullPath)}: duplicate topic_id "${topicId}" also used by ${relative(topics.get(topicId).path)}`);
      continue;
    }

    const appliesTo = frontmatter.lifecycle?.applies_to;
    topics.set(topicId, {
      path: fullPath,
      title: frontmatter.title || topicId,
      appliesTo: Array.isArray(appliesTo) ? appliesTo : [],
      rawAppliesTo: appliesTo,
      body,
      bodyStartLine,
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

function parseVersionRange(range) {
  if (!range) {
    return { error: 'expected a non-empty range, such as "19.0", "20.0+", or "19.0-21.0"' };
  }

  const exactMatch = range.match(new RegExp(`^${versionPattern}$`));
  if (exactMatch) {
    return { endpoints: [range] };
  }

  const openEndedMatch = range.match(new RegExp(`^(${versionPattern})\\+$`));
  if (openEndedMatch) {
    return { endpoints: [openEndedMatch[1]] };
  }

  const closedRangeMatch = range.match(new RegExp(`^(${versionPattern})-(${versionPattern})$`));
  if (closedRangeMatch) {
    const [, start, end] = closedRangeMatch;
    if (compareVersions(start, end) > 0) {
      return { error: `range start "${start}" must be less than or equal to range end "${end}"` };
    }
    return { endpoints: [start, end] };
  }

  return { error: 'expected range syntax "19.0", "20.0+", or "19.0-21.0"' };
}

function findVersionBlocks(topic) {
  const blocks = [];
  const lines = topic.body.split(/\r?\n/);
  let fenced = false;
  let fenceMarker = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenced) {
        fenced = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        fenced = false;
        fenceMarker = null;
      }
      continue;
    }
    if (fenced) continue;
    if (!trimmed.startsWith(":::version")) continue;

    const lineNumber = topic.bodyStartLine + index;
    const block = { lineNumber };
    if (line !== trimmed) {
      block.issue = "version block opening marker must not be indented";
      blocks.push(block);
      continue;
    }

    const match = line.match(/^:::version\s+range="([^"]*)"\s*$/);
    if (!match) {
      block.issue = 'version block opening marker must use syntax :::version range="19.0"';
      blocks.push(block);
      continue;
    }

    const closingIndex = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate === ":::");
    if (closingIndex === -1) {
      block.issue = "version block is missing a closing ::: marker";
      block.range = match[1];
      blocks.push(block);
      continue;
    }

    block.range = match[1];
    blocks.push(block);
    index = closingIndex;
  }

  return blocks;
}

function validateVersionBlocks(topics, releaseNames, issues) {
  const knownReleaseSet = new Set(releaseNames);
  const knownReleaseList = releaseNames.join(", ");

  for (const topic of topics.values()) {
    const appliesTo = Array.isArray(topic.appliesTo) ? topic.appliesTo : [];
    const appliesToSet = new Set(appliesTo);

    for (const block of findVersionBlocks(topic)) {
      const label = `${relative(topic.path)}:${block.lineNumber}`;
      if (block.issue) {
        issues.push(`${label}: ${block.issue}`);
        continue;
      }

      const parsedRange = parseVersionRange(block.range);
      if (parsedRange.error) {
        issues.push(`${label}: invalid version range "${block.range}": ${parsedRange.error}`);
        continue;
      }

      const matchingReleases = releaseNames.filter((releaseName) => releaseMatchesRange(releaseName, block.range));
      if (matchingReleases.length === 0) {
        issues.push(`${label}: version range "${block.range}" does not match any known release (${knownReleaseList})`);
        continue;
      }

      const unknownEndpoints = parsedRange.endpoints.filter((endpoint) => !knownReleaseSet.has(endpoint));
      if (unknownEndpoints.length > 0) {
        issues.push(`${label}: version range "${block.range}" uses unknown endpoint(s) ${unknownEndpoints.join(", ")}; known releases are ${knownReleaseList}`);
      }

      const outsideApplicability = matchingReleases.filter((releaseName) => !appliesToSet.has(releaseName));
      if (outsideApplicability.length > 0) {
        issues.push(`${label}: version range "${block.range}" includes release(s) ${outsideApplicability.join(", ")} outside lifecycle.applies_to [${appliesTo.join(", ")}]`);
      }
    }
  }
}

function validateTopicApplicability(topics, releaseNames, issues) {
  const knownReleaseSet = new Set(releaseNames);
  const knownReleaseList = releaseNames.join(", ");
  const releaseValuePattern = new RegExp(`^${versionPattern}$`);

  for (const topic of topics.values()) {
    const label = `${relative(topic.path)} lifecycle.applies_to`;
    if (!Array.isArray(topic.rawAppliesTo)) {
      issues.push(`${label}: expected an array of known release names (${knownReleaseList})`);
      continue;
    }
    if (topic.rawAppliesTo.length === 0) {
      issues.push(`${label}: must include at least one known release (${knownReleaseList})`);
      continue;
    }

    const seen = new Set();
    for (const releaseName of topic.rawAppliesTo) {
      if (typeof releaseName !== "string" || !releaseValuePattern.test(releaseName)) {
        issues.push(`${label}: invalid release value "${releaseName}"; expected a release like "19.0"`);
        continue;
      }
      if (seen.has(releaseName)) {
        issues.push(`${label}: duplicate release "${releaseName}"`);
        continue;
      }
      seen.add(releaseName);

      if (!knownReleaseSet.has(releaseName)) {
        issues.push(`${label}: unknown release "${releaseName}"; known releases are ${knownReleaseList}`);
      }
    }
  }
}

function requireArray(value, label, issues) {
  if (Array.isArray(value)) return value;
  issues.push(`${label}: expected an array`);
  return [];
}

function validateMetadata(releaseName, metadata, metadataPath, issues) {
  if (metadata.release !== releaseName) {
    issues.push(`${relative(metadataPath)}: release must match directory name "${releaseName}"`);
  }
  for (const field of ["display_name", "publish_path", "status"]) {
    if (!metadata[field]) {
      issues.push(`${relative(metadataPath)}: missing ${field}`);
    }
  }
  if (metadata.publish_path) {
    if (!metadata.publish_path.startsWith("/") || !metadata.publish_path.endsWith("/")) {
      issues.push(`${relative(metadataPath)}: publish_path must start and end with "/"`);
    }
    if (metadata.publish_path.includes("..")) {
      issues.push(`${relative(metadataPath)}: publish_path must not contain ".."`);
    }
  }
  if (typeof metadata.latest !== "boolean") {
    issues.push(`${relative(metadataPath)}: latest must be true or false`);
  }
}

function validateManifest(releaseName, manifest, manifestPath, topics, issues) {
  if (!manifest.book_id) {
    issues.push(`${relative(manifestPath)}: missing book_id`);
  } else if (!bookIdPattern.test(manifest.book_id)) {
    issues.push(`${relative(manifestPath)}: book_id "${manifest.book_id}" must use lowercase kebab-case`);
  }
  if (!manifest.title) {
    issues.push(`${relative(manifestPath)}: missing title`);
  }

  const sections = requireArray(manifest.sections, `${relative(manifestPath)} sections`, issues);
  const sectionTopicSet = new Set();
  const sectionIds = new Set();

  for (const section of sections) {
    if (!section.id) {
      issues.push(`${relative(manifestPath)}: section is missing id`);
    } else {
      if (sectionIds.has(section.id)) {
        issues.push(`${relative(manifestPath)}: duplicate section id "${section.id}"`);
      }
      if (!sectionIdPattern.test(section.id)) {
        issues.push(`${relative(manifestPath)}: section id "${section.id}" must use lowercase kebab-case`);
      }
      sectionIds.add(section.id);
    }

    if (!section.title) {
      issues.push(`${relative(manifestPath)}: section "${section.id || "(missing id)"}" is missing title`);
    }

    for (const topicId of requireArray(section.topics, `${relative(manifestPath)} section "${section.id || "(missing id)"}" topics`, issues)) {
      if (sectionTopicSet.has(topicId)) {
        issues.push(`${relative(manifestPath)}: topic "${topicId}" appears in more than one section`);
      }
      sectionTopicSet.add(topicId);

      const topic = topics.get(topicId);
      if (!topic) {
        issues.push(`${relative(manifestPath)}: section "${section.id || "(missing id)"}" references topic "${topicId}" that does not exist in content repo`);
        continue;
      }
      if (!topic.appliesTo.includes(releaseName)) {
        issues.push(`${relative(manifestPath)}: section "${section.id || "(missing id)"}" references topic "${topicId}" for ${releaseName} but applies_to is [${topic.appliesTo.join(", ")}]`);
      }
    }
  }
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

function main() {
  const issues = [];
  const topics = loadTopics(issues);
  const latestReleases = [];
  let releaseNames = [];

  if (!fs.existsSync(releasesDir)) {
    issues.push(`releases directory not found: ${relative(releasesDir)}`);
  } else {
    releaseNames = fs.readdirSync(releasesDir)
      .filter((entryName) => fs.statSync(path.join(releasesDir, entryName)).isDirectory())
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const releaseName of releaseNames) {
      const releaseRoot = path.join(releasesDir, releaseName);
      const manifestsDir = path.join(releaseRoot, "manifests");
      const manifestFiles = manifestFilesForRelease(releaseRoot);
      const metadataPath = path.join(releaseRoot, "assets", "release-metadata.yml");

      if (!fs.existsSync(manifestsDir)) {
        issues.push(`${relative(releaseRoot)}: missing manifests directory`);
      } else if (manifestFiles.length === 0) {
        issues.push(`${relative(manifestsDir)}: expected at least one .yml guide manifest`);
      }
      if (!fs.existsSync(metadataPath)) {
        issues.push(`${relative(releaseRoot)}: missing assets/release-metadata.yml`);
        continue;
      }

      let metadata;
      try {
        metadata = readYaml(metadataPath);
      } catch (error) {
        issues.push(`${relative(metadataPath)}: ${error.message}`);
        continue;
      }

      validateMetadata(releaseName, metadata, metadataPath, issues);
      const bookIds = new Map();
      for (const manifestFile of manifestFiles) {
        const manifestPath = path.join(manifestsDir, manifestFile);
        let manifest;
        try {
          manifest = readYaml(manifestPath);
        } catch (error) {
          issues.push(`${relative(manifestPath)}: ${error.message}`);
          continue;
        }
        if (manifest.book_id) {
          if (bookIds.has(manifest.book_id)) {
            issues.push(`${relative(manifestPath)}: duplicate book_id "${manifest.book_id}" also used by ${relative(bookIds.get(manifest.book_id))}`);
          } else {
            bookIds.set(manifest.book_id, manifestPath);
          }
        }
        validateManifest(releaseName, manifest, manifestPath, topics, issues);
      }
      if (metadata.latest === true) latestReleases.push(releaseName);
    }
  }

  validateTopicApplicability(topics, releaseNames, issues);
  validateVersionBlocks(topics, releaseNames, issues);

  if (latestReleases.length !== 1) {
    issues.push(`exactly one release must have latest: true; found ${latestReleases.length}`);
  }

  if (issues.length > 0) {
    console.error("Release asset validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Validated release assets against ${topics.size} canonical topics.`);
}

main();
