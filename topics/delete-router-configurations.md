---
topic_id: NET-DELETE-CONFIG-TASK-001
title: Delete router configurations
short_title: Delete configurations
summary: Remove saved configuration profiles that are no longer required for the selected router fleet.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "configuration-admin"]
estimated_time: 6 minutes
permissions: ["administrator"]
tags: ["cleanup", "configuration", "lifecycle"]
owner: Network Docs
last_reviewed: "2026-04-23"
lifecycle:
  introduced_in: "19.9"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0"]
retrieval:
  is_canonical: true
  dedupe_key: delete-router-configurations
  allow_in_ai_results: true
---

# Delete router configurations

Use this procedure to remove saved router configuration entries in release 19.9.

## Before you begin

- Confirm that you have a backup of the running configuration.
- Make sure no active deployment is using the configuration you plan to remove.

## Steps

1. Open **Configuration > Router Profiles**.
2. Select the configuration profile that you want to delete.
3. Click **Actions > Delete Configuration**.
4. Review the confirmation dialog to verify the correct profile is selected.
5. Click **Delete** to remove the configuration from the router profile list.

## Verification

Confirm that the deleted configuration no longer appears in the router profile table.
