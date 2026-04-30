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

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter");
  return parseYaml(match[1]);
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
    try {
      frontmatter = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
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

    topics.set(topicId, {
      path: fullPath,
      title: frontmatter.title || topicId,
      appliesTo: frontmatter.lifecycle?.applies_to || [],
    });
  }

  return topics;
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
  }
  if (!manifest.title) {
    issues.push(`${relative(manifestPath)}: missing title`);
  }

  const manifestTopics = requireArray(manifest.topics, `${relative(manifestPath)} topics`, issues);
  const sections = requireArray(manifest.sections, `${relative(manifestPath)} sections`, issues);
  const manifestTopicSet = new Set();
  const sectionTopicSet = new Set();
  const sectionIds = new Set();

  for (const topicId of manifestTopics) {
    if (manifestTopicSet.has(topicId)) {
      issues.push(`${relative(manifestPath)}: duplicate topic "${topicId}" in topics`);
      continue;
    }
    manifestTopicSet.add(topicId);

    const topic = topics.get(topicId);
    if (!topic) {
      issues.push(`${relative(manifestPath)}: topic "${topicId}" does not exist in content repo`);
      continue;
    }
    if (!topic.appliesTo.includes(releaseName)) {
      issues.push(`${relative(manifestPath)}: topic "${topicId}" is listed for ${releaseName} but applies_to is [${topic.appliesTo.join(", ")}]`);
    }
  }

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

      if (!manifestTopicSet.has(topicId)) {
        issues.push(`${relative(manifestPath)}: section "${section.id || "(missing id)"}" references topic "${topicId}" that is not listed in topics`);
      }
    }
  }

  for (const topicId of manifestTopicSet) {
    if (!sectionTopicSet.has(topicId)) {
      issues.push(`${relative(manifestPath)}: topic "${topicId}" is listed in topics but not in any section`);
    }
  }
}

function main() {
  const issues = [];
  const topics = loadTopics(issues);
  const latestReleases = [];

  if (!fs.existsSync(releasesDir)) {
    issues.push(`releases directory not found: ${relative(releasesDir)}`);
  } else {
    const releaseNames = fs.readdirSync(releasesDir)
      .filter((entryName) => fs.statSync(path.join(releasesDir, entryName)).isDirectory())
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const releaseName of releaseNames) {
      const releaseRoot = path.join(releasesDir, releaseName);
      const manifestPath = path.join(releaseRoot, "manifests", "book.yml");
      const metadataPath = path.join(releaseRoot, "assets", "release-metadata.yml");

      if (!fs.existsSync(manifestPath)) {
        issues.push(`${relative(releaseRoot)}: missing manifests/book.yml`);
        continue;
      }
      if (!fs.existsSync(metadataPath)) {
        issues.push(`${relative(releaseRoot)}: missing assets/release-metadata.yml`);
        continue;
      }

      let manifest;
      let metadata;
      try {
        manifest = readYaml(manifestPath);
      } catch (error) {
        issues.push(`${relative(manifestPath)}: ${error.message}`);
        continue;
      }
      try {
        metadata = readYaml(metadataPath);
      } catch (error) {
        issues.push(`${relative(metadataPath)}: ${error.message}`);
        continue;
      }

      validateMetadata(releaseName, metadata, metadataPath, issues);
      validateManifest(releaseName, manifest, manifestPath, topics, issues);
      if (metadata.latest === true) latestReleases.push(releaseName);
    }
  }

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
