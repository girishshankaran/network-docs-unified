const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const topicsDir = path.join(repoRoot, "topics");

function parseYamlLine(line) {
  const match = line.match(/^([^:]+):(.*)$/);
  if (!match) return null;
  return { key: match[1].trim(), value: match[2].trim() };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ios[\s-]?xr/gi, "ios-xr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function tokeniseFeature(title) {
  const stop = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "on", "your", "with", "in"]);
  return title
    .replace(/IOS-XR/gi, "IOSXR")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.toUpperCase())
    .filter((part) => part && !stop.has(part.toLowerCase()))
    .slice(0, 3);
}

function detectTopicIdMap() {
  const map = new Map();
  for (const fileName of fs.readdirSync(topicsDir)) {
    if (!fileName.endsWith(".md")) continue;
    const source = fs.readFileSync(path.join(topicsDir, fileName), "utf8");
    const match = source.match(/^topic_id:\s*"?([A-Z0-9-]+)"?\s*$/m);
    if (!match) continue;
    map.set(fileName, match[1]);
  }
  return map;
}

function nextTopicId(existingTopicIds, domain, featureStem, type) {
  const prefix = `${domain}-${featureStem}-${type}`;
  let max = 0;
  for (const topicId of existingTopicIds) {
    const idMatch = topicId.match(new RegExp(`^${prefix}-(\\d{3})$`));
    if (!idMatch) continue;
    max = Math.max(max, Number(idMatch[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function assignTopicId(filePath, existingTopicIds) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${path.basename(filePath)}: missing frontmatter`);
  }

  const frontmatter = match[1];
  const body = match[2];
  const lines = frontmatter.split("\n");
  const titleLine = lines.find((line) => line.startsWith("title:"));
  const topicIdIndex = lines.findIndex((line) => line.startsWith("topic_id:"));
  const contentTypeLine = lines.find((line) => line.startsWith("content_type:"));

  if (!titleLine) {
    throw new Error(`${path.basename(filePath)}: cannot assign topic_id without title`);
  }

  const title = titleLine.replace(/^title:\s*/, "").replace(/^"|"$/g, "");
  const type = (contentTypeLine ? contentTypeLine.replace(/^content_type:\s*/, "") : "task").trim().toUpperCase();
  const featureStem = tokeniseFeature(title).join("-");
  const topicId = nextTopicId(existingTopicIds, "NET", featureStem, type);

  if (topicIdIndex >= 0) {
    lines[topicIdIndex] = `topic_id: "${topicId}"`;
  } else {
    lines.splice(0, 0, `topic_id: "${topicId}"`);
  }

  fs.writeFileSync(filePath, `---\n${lines.join("\n")}\n---\n${body}`, "utf8");
  existingTopicIds.add(topicId);
  return topicId;
}

function main() {
  const existingMap = detectTopicIdMap();
  const existingTopicIds = new Set(existingMap.values());
  const assigned = [];

  for (const fileName of fs.readdirSync(topicsDir).sort()) {
    if (!fileName.endsWith(".md")) continue;
    if (existingMap.has(fileName)) continue;
    const filePath = path.join(topicsDir, fileName);
    const topicId = assignTopicId(filePath, existingTopicIds);
    assigned.push({ fileName, topicId });
  }

  if (assigned.length === 0) {
    console.log("No missing topic_id values found.");
    return;
  }

  console.log("Assigned missing topic_id values:");
  for (const item of assigned) {
    console.log(`- ${item.fileName}: ${item.topicId}`);
  }
}

main();
