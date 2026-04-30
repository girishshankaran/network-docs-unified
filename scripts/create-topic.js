const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const topicsDir = path.join(repoRoot, "topics");
const templatePath = path.join(repoRoot, "templates", "topic-template.md");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
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

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : "";
}

function nextTopicId(domain, featureStem, type) {
  const prefix = `${domain}-${featureStem}-${type}`;
  let max = 0;
  for (const fileName of fs.readdirSync(topicsDir)) {
    if (!fileName.endsWith(".md")) continue;
    const source = fs.readFileSync(path.join(topicsDir, fileName), "utf8");
    const frontmatter = parseFrontmatter(source);
    const match = frontmatter.match(/^topic_id:\s*([A-Z0-9-]+)/m);
    if (!match) continue;
    const topicId = match[1];
    const idMatch = topicId.match(new RegExp(`^${prefix}-(\\d{3})$`));
    if (!idMatch) continue;
    max = Math.max(max, Number(idMatch[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function csvToYamlList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `"${item}"`)
    .join(", ");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const title = args.title;
  if (!title) {
    console.error('Usage: node scripts/create-topic.js --title "Topic title" [--release "20.0"] [--type task] [--domain NET]');
    process.exit(1);
  }

  const type = String(args.type || "task").toUpperCase();
  const contentType = String(args.type || "task").toLowerCase();
  const domain = String(args.domain || "NET").toUpperCase();
  const slug = args.slug || slugify(title);
  const featureStem = tokeniseFeature(title).join("-");
  const topicId = nextTopicId(domain, featureStem, type);
  const appliesTo = csvToYamlList(args.release || args["applies-to"] || "");
  const template = fs.readFileSync(templatePath, "utf8");
  const outputPath = path.join(topicsDir, `${slug}.md`);

  if (fs.existsSync(outputPath)) {
    console.error(`Topic already exists: ${outputPath}`);
    process.exit(1);
  }

  const summary = args.summary || "complete the router task";
  const today = new Date().toISOString().slice(0, 10);
  const content = template
    .replace(/{{TOPIC_ID}}/g, topicId)
    .replace(/{{TITLE}}/g, title)
    .replace(/{{SHORT_TITLE}}/g, args["short-title"] || title)
    .replace(/{{SUMMARY}}/g, summary)
    .replace(/{{SUMMARY_LOWER}}/g, summary.charAt(0).toLowerCase() + summary.slice(1))
    .replace(/{{PRODUCT}}/g, args.product || "Cisco Router Operations Manager")
    .replace(/{{PLATFORM}}/g, args.platform || "IOS-XR routers")
    .replace(/{{CONTENT_TYPE}}/g, contentType)
    .replace(/{{AUDIENCE}}/g, csvToYamlList(args.audience || "network-operations"))
    .replace(/{{ESTIMATED_TIME}}/g, args["estimated-time"] || "10 minutes")
    .replace(/{{PERMISSIONS}}/g, csvToYamlList(args.permissions || "administrator"))
    .replace(/{{TAGS}}/g, csvToYamlList(args.tags || slug.replace(/-/g, ",")))
    .replace(/{{OWNER}}/g, args.owner || "Network Docs")
    .replace(/{{LAST_REVIEWED}}/g, args["last-reviewed"] || today)
    .replace(/{{INTRODUCED_IN}}/g, args.release || args["introduced-in"] || "TBD")
    .replace(/{{APPLIES_TO}}/g, appliesTo || '"TBD"')
    .replace(/{{DEDUPE_KEY}}/g, slug);

  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Created ${outputPath}`);
  console.log(`Assigned topic_id: ${topicId}`);
}

main();
