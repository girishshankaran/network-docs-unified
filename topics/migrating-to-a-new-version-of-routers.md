---
topic_id: "NET-MIGRATING-NEW-VERSION-ROUTERS-TASK-001"
title: "Migrating to a new version of routers"
short_title: "Migrate routers"
summary: "Move managed routers to a new supported version while preserving access, configuration, and operational continuity."
product: "Cisco Router Operations Manager"
platform: "IOS-XR routers"
content_type: "task"
audience: ["network-operations", "platform-admin"]
estimated_time: "25 minutes"
permissions: ["administrator"]
tags: ["migration", "upgrade", "router-lifecycle"]
owner: "Network Docs"
last_reviewed: "2026-04-25"
lifecycle:
  introduced_in: "19.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0","21.0"]
retrieval:
  is_canonical: true
  dedupe_key: "migrating-to-a-new-version-of-routers"
  allow_in_ai_results: true
---

# Migrating to a new version of routers

Use this procedure to migrate managed routers to a new supported version.

## Before you begin

- Confirm that the target version is approved for the router model and deployment profile.
- Back up the running configuration for each router in the migration group.
- Verify that out-of-band access is available before starting the migration.
- Review maintenance windows, rollback criteria, and stakeholder notifications.

## Steps

1. Open **Lifecycle > Router Migration**.
2. Select the router or router group that you want to migrate.
3. Choose the target router version from the approved version list.
4. Review compatibility warnings, required configuration changes, and estimated downtime.
5. Run the pre-migration validation checks.
6. Resolve any blocking validation issues before continuing.
7. Click **Start Migration**.
8. Monitor the migration status until all selected routers report the target version.
9. Save the migration report for audit and support records.

## Rollback

If the migration fails validation or the router does not return to a healthy state, use the saved configuration backup and approved rollback image to restore the previous version.

## Verification

Confirm that the router inventory shows the target version, the device health status is normal, and critical services are reachable after migration.
