const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

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

function releaseMetadata(repoRoot, releaseName) {
  const metadataPath = path.join(repoRoot, "releases", releaseName, "assets", "release-metadata.yml");
  return parseYaml(fs.readFileSync(metadataPath, "utf8"));
}

function releaseAcceptsUpdates(metadata) {
  return metadata.publish !== false;
}

function releaseNames(repoRoot) {
  const releasesDir = path.join(repoRoot, "releases");
  return fs.readdirSync(releasesDir)
    .filter((entryName) => fs.statSync(path.join(releasesDir, entryName)).isDirectory())
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function runText(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
}

function publishTags(repoRoot) {
  const output = runText("git", [
    "for-each-ref",
    "--sort=-creatordate",
    "--format=%(refname:short)",
    "refs/tags/publish-*",
  ], repoRoot);
  return output.split(/\r?\n/).filter(Boolean);
}

function publishTagScope(tag) {
  const match = tag.match(/^publish-\d{8}-(.+)-\d+-[a-zA-Z0-9]+$/);
  return match ? match[1].split("_") : [];
}

function latestPublishTagForRelease(repoRoot, releaseName) {
  return publishTags(repoRoot)
    .find((tag) => publishTagScope(tag).includes(releaseName)) || null;
}

function normalizePublishPath(metadata, releaseName) {
  const rawPath = metadata.publish_path || `/${releaseName}/`;
  const trimmedPath = rawPath.replace(/^\/+|\/+$/g, "");
  return trimmedPath ? `/${trimmedPath}/` : "/";
}

function outputDirForRelease(repoRoot, metadata, releaseName) {
  const normalized = normalizePublishPath(metadata, releaseName).replace(/^\/|\/$/g, "");
  return normalized ? path.join(repoRoot, "site", ...normalized.split("/")) : path.join(repoRoot, "site");
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root || args._[0] || ".");
  const releases = releaseNames(repoRoot).map((releaseName) => ({
    releaseName,
    metadata: releaseMetadata(repoRoot, releaseName),
  }));
  const frozen = releases
    .filter((release) => !releaseAcceptsUpdates(release.metadata))
    .map((release) => ({
      ...release,
      sourceTag: latestPublishTagForRelease(repoRoot, release.releaseName),
    }));

  if (frozen.length === 0) {
    run("node", ["scripts/build-site.js", "."], repoRoot);
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "network-docs-publish-"));
  const worktrees = new Map();

  try {
    run("node", ["scripts/build-site.js", "."], repoRoot);

    for (const release of frozen) {
      if (!release.sourceTag) {
        console.warn(`No publish tag found for frozen release output: ${release.releaseName}`);
        continue;
      }

      let snapshotRoot = worktrees.get(release.sourceTag);
      if (!snapshotRoot) {
        snapshotRoot = path.join(tempRoot, release.sourceTag);
        run("git", ["worktree", "add", "--detach", snapshotRoot, release.sourceTag], repoRoot);
        worktrees.set(release.sourceTag, snapshotRoot);
      }

      run("node", ["scripts/build-site.js", ".", "--releases", release.releaseName, "--include-frozen"], snapshotRoot);
      const snapshotMetadata = releaseMetadata(snapshotRoot, release.releaseName);
      copyDir(
        outputDirForRelease(snapshotRoot, snapshotMetadata, release.releaseName),
        outputDirForRelease(repoRoot, release.metadata, release.releaseName)
      );

      console.log(`Preserved frozen release output from ${release.sourceTag}: ${release.releaseName}`);
    }
  } finally {
    for (const snapshotRoot of worktrees.values()) {
      try {
        run("git", ["worktree", "remove", "--force", snapshotRoot], repoRoot);
      } catch (_error) {
        // The temp directory is removed below; a stale worktree should not hide the build result.
      }
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
