# network-docs-unified

Single-repository documentation publishing prototype.

This project keeps the core Option 2 separation while removing the two-repository coordination cost:

- `topics/` stores canonical authored topics.
- `snippets/` stores optional shared fragments.
- `releases/<version>/` stores release-specific guide manifests and metadata.
- `site/` is generated output and is ignored by Git.

The sample content is copied from the existing two-repo implementation and uses releases `19.0`, `20.0`, and `21.0`. The model also supports folders such as `releases/17.10`, `releases/17.12`, or `releases/latest`.

## Authoring Flow

1. Create a development branch.
2. Edit canonical topics in `topics/`, shared fragments in `snippets/`, or release assembly files in `releases/<version>/`.
3. Open a pull request and run validation.
4. Merge approved changes to `main` or `master`.
5. The publish workflow detects impacted release outputs, builds a complete GitHub Pages artifact, deploys it, and creates a Git tag for the publish snapshot.

There are no feature-specific release branches in this model. Publish history is recovered through Git tags such as `publish-20260430-21.0-123-abcdef123456`.

## Commands

Validate canonical topics and release assembly:

```sh
npm run validate
```

Show release packaging suggestions:

```sh
npm run suggest
```

Build all release outputs:

```sh
npm run build
```

Build selected release outputs:

```sh
node scripts/build-site.js . --releases 20.0,21.0
```

Detect impacted releases from explicit changed files:

```sh
node scripts/detect-impacted-releases.js . --files topics/create-api-docs-using-pubhub.md
node scripts/detect-impacted-releases.js . --files releases/20.0/manifests/configuration-guide.yml
```

Detect impacted releases from a Git range:

```sh
node scripts/detect-impacted-releases.js . --base origin/main --head HEAD
```

## Impact Rules

- A change under `releases/<version>/` rebuilds only that release output.
- A change under `topics/` rebuilds releases where any guide manifest section includes the topic ID and whose release is listed in the topic lifecycle metadata.
- A change under `snippets/`, `templates/`, `schemas/`, `scripts/`, or `.github/workflows/` rebuilds all release outputs.
- A docs-only change does not trigger a release output build.

For GitHub Pages, the workflow deploys a complete `site/` artifact because Pages artifact deployments replace the previous site. Impact detection still controls whether publishing is needed and records which release outputs caused the publish tag.

For cloud/latest-only products, create a single assembly folder such as `releases/latest` or a product-specific folder with metadata that publishes to `/latest/`.

## GitHub Pages

The workflow in `.github/workflows/publish.yml` uses `actions/upload-pages-artifact` and `actions/deploy-pages`, matching the previous implementation pattern.

Before the first publish, configure the GitHub repository Pages source to use GitHub Actions. A merge to `main` or `master` publishes to the repository's GitHub Pages URL and tags the published snapshot after deployment succeeds.
