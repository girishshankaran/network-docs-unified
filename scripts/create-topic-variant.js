const fs = require("fs");
const path = require("path");
const {
  applicableReleaseNames,
  loadContentModel,
  loadTopics,
  parseArgs,
  releaseById,
  slugify,
} = require("./common");

function usage() {
  console.error(`Usage:
node scripts/create-topic-variant.js . \\
  --from-topic NET-PROXY-TASK-001 \\
  --release 21.0 \\
  [--releases 21.0,22.0] \\
  [--slug configure-proxy-21-0] \\
  [--topic-id NET-PROXY-TASK-002] \\
  [--update-manifests] \\
  [--dry-run]

Creates a new topic variant with the next topic_id in the same topic family.`);
}

function scalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlList(values) {
  return `[${values.map(scalar).join(", ")}]`;
}

function parseCsv(value) {
  if (!value || value === true) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function releaseSlug(releaseName) {
  return slugify(String(releaseName).replace(/\./g, "-"));
}

function topicIdPrefix(topicId) {
  const match = String(topicId).match(/^(.+)-(\d+)$/);
  if (!match) throw new Error(`Cannot derive numeric suffix from topic_id "${topicId}"`);
  return { prefix: match[1], number: Number(match[2]), width: match[2].length };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextTopicId(sourceTopic, familyTopics) {
  const { prefix, width } = topicIdPrefix(sourceTopic.topicId);
  let max = 0;
  for (const topic of familyTopics) {
    const match = String(topic.topicId).match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

function metadataLine(frontmatter, key) {
  const value = frontmatter[key];
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return `${key}: ${yamlList(value)}`;
  return `${key}: ${scalar(value)}`;
}

function frontmatterForVariant(sourceTopic, newTopicId, releaseName, targetReleases) {
  const source = sourceTopic.frontmatter;
  const retrieval = source.retrieval || {};
  const metadataKeys = [
    "short_title",
    "summary",
    "product",
    "platform",
    "content_type",
    "audience",
    "estimated_time",
    "permissions",
    "tags",
    "owner",
    "last_reviewed",
  ];

  return [
    "---",
    `topic_id: ${newTopicId}`,
    `title: ${source.title ? scalar(source.title) : scalar(sourceTopic.title)}`,
    ...metadataKeys.map((key) => metadataLine(source, key)).filter(Boolean),
    "lifecycle:",
    `  introduced_in: ${scalar(releaseName)}`,
    "  updated_in: []",
    `  deprecated_in: ${scalar(source.lifecycle?.deprecated_in || null)}`,
    "  status: active",
    "  replaced_by: null",
    `  applies_to: ${yamlList(targetReleases)}`,
    "retrieval:",
    `  is_canonical: ${retrieval.is_canonical === false ? "false" : "true"}`,
    `  dedupe_key: ${scalar(retrieval.dedupe_key)}`,
    `  allow_in_ai_results: ${retrieval.allow_in_ai_results === false ? "false" : "true"}`,
    "---",
    "",
  ].join("\n");
}

function filteredUpdatedIn(sourceTopic, remainingReleases) {
  const updatedIn = sourceTopic.lifecycle?.updated_in;
  if (!Array.isArray(updatedIn)) return [];
  const remaining = new Set(remainingReleases);
  return updatedIn.filter((releaseName) => remaining.has(releaseName));
}

function updateSourceLifecycle(sourceText, sourceTopic, releaseName, targetReleases, newTopicId) {
  const targetSet = new Set(targetReleases);
  const currentAppliesTo = Array.isArray(sourceTopic.lifecycle?.applies_to)
    ? sourceTopic.lifecycle.applies_to
    : [];
  const remaining = currentAppliesTo.filter((candidate) => !targetSet.has(candidate));
  const appliesTo = remaining.length > 0 ? remaining : [releaseName];
  const status = remaining.length > 0 ? sourceTopic.lifecycle.status || "active" : "replaced";

  const replacement = [
    "lifecycle:",
    `  introduced_in: ${scalar(sourceTopic.lifecycle.introduced_in || appliesTo[0] || releaseName)}`,
    `  updated_in: ${yamlList(filteredUpdatedIn(sourceTopic, appliesTo))}`,
    `  deprecated_in: ${scalar(sourceTopic.lifecycle.deprecated_in || null)}`,
    `  status: ${status}`,
    `  replaced_by: ${newTopicId}`,
    `  applies_to: ${yamlList(appliesTo)}`,
    "retrieval:",
  ].join("\n");

  if (!sourceText.match(/\nlifecycle:\n[\s\S]*?\nretrieval:\n/)) {
    throw new Error(`Could not find lifecycle block in ${sourceTopic.relativePath}`);
  }

  return sourceText.replace(/\nlifecycle:\n[\s\S]*?\nretrieval:\n/, `\n${replacement}\n`);
}

function replaceTopicIdInManifest(source, oldTopicId, newTopicId) {
  const quoted = source.replace(new RegExp(`(["'])${escapeRegExp(oldTopicId)}\\1`, "g"), `$1${newTopicId}$1`);
  if (quoted !== source) return quoted;
  return source.replace(new RegExp(`\\b${escapeRegExp(oldTopicId)}\\b`, "g"), newTopicId);
}

function plannedManifestUpdates(model, sourceTopic, newTopicId, targetReleaseNames) {
  const updates = [];
  const targetSet = new Set(targetReleaseNames);

  for (const release of model.releases) {
    if (!targetSet.has(release.releaseName)) continue;
    for (const guide of release.guides) {
      const source = fs.readFileSync(guide.manifestPath, "utf8");
      if (!source.includes(sourceTopic.topicId)) continue;
      const next = replaceTopicIdInManifest(source, sourceTopic.topicId, newTopicId);
      if (next !== source) updates.push({ path: guide.manifestPath, source, next });
    }
  }

  return updates;
}

function defaultTargetReleases(model, sourceTopic, releaseName) {
  const release = releaseById(model, releaseName);
  const currentAppliesTo = applicableReleaseNames(model, sourceTopic);
  const targets = currentAppliesTo.filter((candidate) => {
    const candidateRelease = releaseById(model, candidate);
    return candidateRelease && release && candidateRelease.order >= release.order;
  });
  return targets.length > 0 ? targets : [releaseName];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root || args._[0] || ".");
  const fromTopicId = args["from-topic"];
  const releaseName = args.release;
  const dryRun = args["dry-run"] === true;
  const updateManifests = args["update-manifests"] === true;

  if (!fromTopicId || !releaseName) {
    usage();
    process.exit(1);
  }

  const model = loadContentModel(repoRoot);
  const release = releaseById(model, releaseName);
  if (!release) {
    console.error(`Unknown release: ${releaseName}`);
    process.exit(1);
  }

  const topics = loadTopics(repoRoot);
  const sourceTopic = topics.get(fromTopicId);
  if (!sourceTopic) {
    console.error(`Unknown source topic: ${fromTopicId}`);
    process.exit(1);
  }
  if (!sourceTopic.retrieval?.dedupe_key) {
    console.error(`${sourceTopic.relativePath} is missing retrieval.dedupe_key`);
    process.exit(1);
  }

  const explicitTargets = parseCsv(args.releases);
  const targetReleases = explicitTargets.length > 0
    ? explicitTargets
    : defaultTargetReleases(model, sourceTopic, releaseName);
  const unknownTargets = targetReleases.filter((target) => !releaseById(model, target));
  if (unknownTargets.length > 0) {
    console.error(`Unknown target release(s): ${unknownTargets.join(", ")}`);
    process.exit(1);
  }

  const familyTopics = [...topics.values()].filter((topic) => topic.retrieval?.dedupe_key === sourceTopic.retrieval.dedupe_key);
  const newTopicId = args["topic-id"] || nextTopicId(sourceTopic, familyTopics);
  if (topics.has(newTopicId)) {
    console.error(`Topic already exists: ${newTopicId}`);
    process.exit(1);
  }

  const outputSlug = args.slug || `${sourceTopic.slug.replace(/-\d+-\d+$/, "")}-${releaseSlug(releaseName)}`;
  const outputPath = path.join(model.topicsDir, `${outputSlug}.md`);
  if (fs.existsSync(outputPath)) {
    console.error(`Topic file already exists: ${path.relative(repoRoot, outputPath)}`);
    process.exit(1);
  }

  const sourceText = fs.readFileSync(sourceTopic.path, "utf8");
  const newContent = `${frontmatterForVariant(sourceTopic, newTopicId, releaseName, targetReleases)}${sourceTopic.body.trim()}\n`;
  const sourceNext = updateSourceLifecycle(sourceText, sourceTopic, releaseName, targetReleases, newTopicId);
  const manifestUpdates = updateManifests
    ? plannedManifestUpdates(model, sourceTopic, newTopicId, targetReleases)
    : [];

  console.log("Create topic variant:");
  console.log(`- source: ${sourceTopic.topicId} (${sourceTopic.relativePath})`);
  console.log(`- new topic_id: ${newTopicId}`);
  console.log(`- new file: ${path.relative(repoRoot, outputPath)}`);
  console.log(`- dedupe_key: ${sourceTopic.retrieval.dedupe_key}`);
  console.log(`- introduced_in: ${releaseName}`);
  console.log(`- applies_to: ${targetReleases.join(", ")}`);
  if (updateManifests) {
    console.log(`- manifest updates: ${manifestUpdates.length}`);
    for (const update of manifestUpdates) console.log(`  - ${path.relative(repoRoot, update.path)}`);
  }

  if (dryRun) {
    console.log("Dry run only. No files were changed.");
    return;
  }

  fs.writeFileSync(outputPath, newContent, "utf8");
  fs.writeFileSync(sourceTopic.path, sourceNext, "utf8");
  for (const update of manifestUpdates) {
    fs.writeFileSync(update.path, update.next, "utf8");
  }
}

main();
