---
topic_id: "NET-CREATE-PUBLISH-API-TASK-001"
title: Create and publish API documentation in PubHub
short_title: Publish API Documentation
summary: Create an API documentation site from the OpenAPI Template Project
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 5 minutes
permissions: ["administrator"]
tags: ["ssh", "access", "security"]
owner: Network Docs
last_reviewed: "2026-04-23"
lifecycle:
  introduced_in: "19.0"
  updated_in: ["20.0"]
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["20.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: create-and-publish-api-docs
  allow_in_ai_results: true
---

# Create and publish API documentation in PubHub

Use this task to create an API documentation site from the OpenAPI Template Project, update the generated GitHub repository, and publish the site through PubHub.

## Prerequisites

Before you begin, make sure that you have the following items:

1. A PubHub project created from the OpenAPI Template Project.
2. Access to the generated GitHub repository for the project.
3. An approved OpenAPI specification in JSON or YAML format for the release that you want to document.

## Project structure

The generated repository includes the standard folders for an API documentation set.

| Folder or file | Description |
| --- | --- |
| `config.json` | Defines site-level metadata and the OpenAPI file used by the site. |
| `overview/` | Stores introductory topics such as the overview, getting started information, and changelog. |
| `reference/` | Stores the API reference topics and the OpenAPI file consumed by the site. |
| `guides/` | Stores task-based and workflow-based guidance. |
| `images/` | Stores screenshots and other images. |
| `resources/` | Stores downloadable assets and supporting resources. |
| `support/` | Stores support and community topics. |

## Procedure

1. In PubHub, create the API documentation project from the OpenAPI Template Project, open the project, and click **Edit in GitHub**.
2. Clone the generated GitHub repository to your local workspace. If you are reusing approved content from an earlier documentation set, copy only the project files into the new repository.
3. Copy the approved OpenAPI specification into the repository location used by the template. In the recorded workflow, the target file is `reference/openapi.json`.
4. Compare the new OpenAPI specification with the previously published specification, identify the substantive API changes, and create a changelist that matches the structure and terminology used in the existing documentation set.
5. Use the changelist to update `overview/changelog.md`, and update `overview/intro.md`, `overview/getting-started.md`, and `reference/overview.md` so that they reflect the current API scope and release.
6. Open `config.json` and update the OpenAPI file reference, version strings, and any other labels or file references that still point to an earlier release.
7. Review the content to confirm that placeholder text is removed and that links, release numbers, file references, and changelog entries are correct.
8. Commit the updated files and push the changes to the branch connected to the PubHub project.
9. In PubHub, click **Sync repo**, preview the site on staging, and if the output is correct, click **Request to publish** and complete the required approval steps.

## Result

The site is updated in PubHub and submitted for publication with the latest OpenAPI file and user-facing content.

:::version range="20.0"
## What to review before publication
:::

:::version range="21.0"
## Before you publish
:::

Review the following items before you request publication:

1. The overview topics describe the current release and not the template defaults.
2. The API reference shows the expected endpoints, parameters, schemas, and example payloads.
3. The changelist is aligned with the existing content model and uses the same terminology, grouping, and level of detail as earlier releases.
4. The OpenAPI file downloaded from the site, if exposed, matches the intended release.
5. Navigation, search, and topic links work as expected in the staging site.
