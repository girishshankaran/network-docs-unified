const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const topicsDir = path.join(repoRoot, "topics");
const topicIdPattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-(TASK|CONCEPT|REFERENCE)-\d{3}$/;
const allowMissingTopicId = process.argv.includes("--allow-missing-topic-id") || process.env.ALLOW_MISSING_TOPIC_ID === "true";

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
  return parseYaml(match[1]);
}

function main() {
  const issues = [];
  const topicIdMap = new Map();
  const topicFiles = fs.readdirSync(topicsDir).filter((fileName) => fileName.endsWith(".md")).sort();

  for (const fileName of topicFiles) {
    const fullPath = path.join(topicsDir, fileName);
    let frontmatter;

    try {
      frontmatter = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
      issues.push(`${fileName}: ${error.message}`);
      continue;
    }

    const topicId = frontmatter.topic_id;
    if (!topicId) {
      if (allowMissingTopicId) {
        console.warn(`Warning: ${fileName} is missing topic_id (allowed in draft mode).`);
      } else {
        issues.push(`${fileName}: missing topic_id`);
      }
      continue;
    }

    if (!topicIdPattern.test(topicId)) {
      issues.push(`${fileName}: invalid topic_id format "${topicId}"`);
    }

    if (!topicIdMap.has(topicId)) {
      topicIdMap.set(topicId, []);
    }
    topicIdMap.get(topicId).push(fileName);
  }

  for (const [topicId, fileNames] of topicIdMap.entries()) {
    if (fileNames.length > 1) {
      issues.push(`duplicate topic_id "${topicId}" found in: ${fileNames.join(", ")}`);
    }
  }

  if (issues.length > 0) {
    console.error("Content validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${topicFiles.length} canonical topics. No duplicate topic_id values found${allowMissingTopicId ? " (draft mode allowed missing topic_id)." : "."}`);
}

main();
