---
topic_id: NET-WHATS-NEW-CONCEPT-001
title: What's new
short_title: What's new
summary: Review the major capabilities introduced across supported router administration releases.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: concept
audience: ["network-operations", "platform-admin"]
estimated_time: 4 minutes
permissions: ["administrator"]
tags: ["release-notes", "new-features", "overview"]
owner: Network Docs
last_reviewed: "2026-05-01"
lifecycle:
  introduced_in: "19.0"
  updated_in: ["20.0"]
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "20.0"]
retrieval:
  is_canonical: true
  dedupe_key: whats-new-router-admin
  allow_in_ai_results: true
---

# What's new

Use this overview to identify the major capabilities introduced in router administration releases 19.0 and 20.0.

:::version range="19.0"
## Release 19.0 features

Release 19.0 introduces the foundational router administration workflows for secure access, lifecycle operations, and operational troubleshooting.

- **Secure administrative access:** Enable SSH access and generate SSH key material for managed routers.
- **Troubleshooting workflow:** Diagnose router connectivity, interface, and health issues before escalating to support.
- **Router migration:** Move managed routers to a new supported version while preserving access and configuration.
- **Software deployment:** Upload, stage, and deploy IOS-XR software images to supported routers.
- **Configuration cleanup:** Remove saved router configuration profiles that are no longer required.
:::

:::version range="20.0"
## Release 20.0 features

Release 20.0 expands router administration with updated access controls, software upgrade workflows, and publishing support.

- **Updated SSH workflow:** Configure SSH access from the security access area and apply access policies.
- **Outbound proxy support:** Configure router-initiated traffic to use approved proxy servers.
- **Router software upgrades:** Upload and activate approved software images for managed routers.
- **API documentation publishing:** Create and publish API documentation from an OpenAPI Template Project through PubHub.
- **Authentication guidance:** Configure authentication patterns for routers and switches.
:::
