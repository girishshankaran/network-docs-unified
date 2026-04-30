---
topic_id: NET-UPGRADE-TASK-001
title: Upgrading your routers
short_title: Upgrade routers
summary: Upload and activate a new approved software image on managed routers in release 20.0.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 15 minutes
permissions: ["administrator"]
tags: ["upgrade", "software", "maintenance"]
owner: Network Docs
last_reviewed: "2026-04-23"
lifecycle:
  introduced_in: "20.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["20.0"]
retrieval:
  is_canonical: true
  dedupe_key: upgrade-your-routers
  allow_in_ai_results: true
---

# Upgrading your routers

Use this procedure to upgrade router software in release 20.0.

## Before you begin

- Download the approved software image for the target router model.
- Verify that the current configuration is backed up.
- Schedule a maintenance window because the router restarts during the upgrade.

## Steps

1. Open **Administration > Software Management**.
2. Click **Upload Image** and select the router software package.
3. Verify the image details and compatibility information.
4. Click **Set as Upgrade Image**.
5. Select the routers to upgrade.
6. Click **Start Upgrade** and confirm the restart action.
7. Wait for the routers to return to an `Up` state.

## Verification

Confirm that the router inventory page shows the expected software version after the upgrade completes.
