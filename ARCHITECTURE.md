# Architecture

This prototype uses one Git repository with clear folder boundaries between canonical content and release-specific assembly.

```text
network-docs-unified/
  topics/
  snippets/
  templates/
  schemas/
  releases/
    19.0/
      manifests/
        admin-guide.yml
        configuration-guide.yml
      assets/release-metadata.yml
    20.0/
    21.0/
  scripts/
  .github/workflows/
```

## Responsibilities

`topics/` is the single source of truth for authored content. A topic is reusable across releases through frontmatter:

- `topic_id` identifies the canonical topic.
- `lifecycle.applies_to` lists releases where the topic is valid.
- `retrieval` stores canonical and AI-retrieval metadata.

`releases/<version>/` owns release assembly. Each release has:

- `manifests/*.yml`, where each file is one guide with a stable `book_id`, title, sections, and topic order.
- `assets/release-metadata.yml`, which defines display name, publish path, status, latest flag, and the optional publish gate.

`scripts/` owns validation, impact detection, and static output generation.

## Inclusion Model

A topic appears in a release only when both conditions are true:

1. Any guide manifest under `releases/<version>/manifests/` includes the topic ID in a section.
2. The topic frontmatter includes the release in `lifecycle.applies_to`.

This preserves canonical reuse while allowing each release to decide its own assembled navigation.

`admin-guide.yml` is the default guide manifest for a release. It continues to publish at the release root, such as `/20.0/`, so existing release URLs remain stable. Additional guide manifests publish under their `book_id`, such as `/20.0/configuration-guide/`.

## Impact-Based Publishing

After a merge to `main`, the workflow compares the changed files and computes impacted release outputs:

```text
topics/<slug>.md
  -> find topic_id
  -> find release guide manifests with sections that include that topic_id
  -> intersect with lifecycle.applies_to
  -> rebuild those release outputs

releases/<version>/**
  -> rebuild only <version> when publish is true

snippets/**, templates/**, schemas/**, scripts/**, workflows
  -> rebuild all release outputs with publish: true
```

The detector is implemented in `scripts/detect-impacted-releases.js`. The builder accepts a targeted release list:

```sh
node scripts/build-site.js . --releases 20.0,21.0
```

The GitHub Pages workflow intentionally builds a complete `site/` artifact before deployment. GitHub Pages artifact deployments replace the previous site, so a partial artifact would remove unimpacted release folders. Impact detection remains the source of truth for deciding whether a publish is necessary and for recording the affected release scope in the publish tag.

When a release has `publish: false`, the production build restores that release's generated output from the latest publish tag that included the release and overlays current outputs only for releases with `publish: true`. This keeps already-published release pages online while preventing new topics or manifest changes from appearing in the frozen release.

## Release Publish Gate

Each `release-metadata.yml` file can include:

```yml
publish: true
```

Omitting `publish` is treated the same as `publish: true` for backward compatibility. Set `publish: false` while a release is frozen. Writers can merge reviewed topics and manifests to `main`, but the workflow skips current-branch updates for that release until the gate is changed to `publish: true`. The existing release output stays in the generated Pages artifact by being restored from the latest publish tag that included the release.

## Publish Tags

The workflow creates a Git tag after a publish from `main`. Tags are intended to record the repository snapshot that produced a published state.

The default tag format is:

```text
publish-YYYYMMDD-<release-scope>-<run-number>-<short-sha>
```

Examples:

```text
publish-20260430-20.0_21.0-42-abc123def456
publish-20260430-no-release-output-43-abc123def456
```

## Cloud Products

Cloud or latest-only products can use the same structure with a single release assembly folder:

```text
releases/latest/
  manifests/
    admin-guide.yml
  assets/release-metadata.yml
```

The metadata can publish to `/latest/`, while versioned products use `/17.10/`, `/17.12/`, and similar paths. This keeps one authoring model across release-based and latest-only documentation.
