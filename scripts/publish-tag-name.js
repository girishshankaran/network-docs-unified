const fs = require("fs");

function sanitize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main() {
  const sha = (process.env.GITHUB_SHA || "local").slice(0, 12);
  const runNumber = process.env.GITHUB_RUN_NUMBER || "0";
  const rawImpacted = process.env.IMPACTED_RELEASES || "";
  const impacted = rawImpacted.split(",").map((item) => item.trim()).filter(Boolean);
  const scope = impacted.length > 0 ? impacted.join("_") : "no-release-output";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tag = `publish-${date}-${sanitize(scope)}-${runNumber}-${sha}`;

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
  }

  console.log(tag);
}

main();
