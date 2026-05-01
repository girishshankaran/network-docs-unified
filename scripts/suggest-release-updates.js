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
let hasSuggestions = false;

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

function loadTopics() {
  return fs.readdirSync(topicsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const fullPath = path.join(topicsDir, fileName);
      const { frontmatter } = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
      return {
        topicId: frontmatter.topic_id,
        slug: fileName.replace(/\.md$/, ""),
        title: frontmatter.title,
        appliesTo: frontmatter.lifecycle?.applies_to || [],
      };
    });
}

function loadReleaseConfig(releaseName) {
  const releaseRoot = path.join(releasesDir, releaseName);
  const manifestsDir = path.join(releaseRoot, "manifests");
  const guides = fs.readdirSync(manifestsDir)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    .map((manifestFile) => ({
      manifestFile,
      manifest: parseYaml(fs.readFileSync(path.join(manifestsDir, manifestFile), "utf8")),
    }));
  return {
    releaseName,
    guides,
  };
}

function suggestSection(topic) {
  const source = `${topic.title} ${topic.slug}`.toLowerCase();
  if (source.includes("ssh")) return { id: "access", title: "Access" };
  if (source.includes("proxy")) return { id: "proxy", title: "Proxy" };
  if (source.includes("dhcp")) return { id: "dhcp", title: "DHCP" };
  if (source.includes("vlan")) return { id: "vlan", title: "VLAN" };
  if (source.includes("delete") || source.includes("cleanup")) return { id: "cleanup", title: "Cleanup" };
  return { id: "misc", title: "Additional tasks" };
}

function topicIdsFromSections(sections) {
  return sections.flatMap((section) => section.topics || []);
}

function main() {
  const topics = loadTopics();
  const releases = fs.readdirSync(releasesDir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const releaseName of releases) {
    const release = loadReleaseConfig(releaseName);
    const sectionTopics = new Set(release.guides.flatMap((guide) => topicIdsFromSections(guide.manifest.sections || [])));

    const missingFromSections = topics
      .filter((topic) => topic.appliesTo.includes(releaseName))
      .filter((topic) => !sectionTopics.has(topic.topicId));

    console.log(`\nRelease ${releaseName}`);
    console.log("-".repeat(`Release ${releaseName}`.length));

    if (missingFromSections.length === 0) {
      console.log("No suggestions.");
      continue;
    }

    hasSuggestions = true;
    console.log("Suggested additions to release sections:");
    for (const topic of missingFromSections) {
      const section = suggestSection(topic);
      console.log(`- ${topic.topicId} (${topic.title})`);
      console.log(`  suggested section: ${section.title} [${section.id}]`);
    }
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    if (hasSuggestions) {
      console.log("::warning title=Release packaging suggestions detected::One or more topics are applicable to a release but missing from that release manifest or sections. Review the suggestion output above.");
    } else {
      console.log("No release packaging suggestions detected.");
    }
  }
}

main();
