---
topic_id: NET-INTERFACE-DESCRIPTION-TASK-001
title: Configure interface descriptions
short_title: Configure interface descriptions
summary: Add interface descriptions that help operators identify links, circuits, and connected devices.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 6 minutes
permissions: ["administrator"]
tags: ["interfaces", "configuration", "inventory"]
owner: Network Docs
last_reviewed: "2026-05-01"
lifecycle:
  introduced_in: "19.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "20.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-interface-descriptions
  allow_in_ai_results: true
---

# Configure interface descriptions

Use this procedure to add descriptions to router interfaces so operators can identify link ownership and purpose.

## Before you begin

- Confirm the interface name and connected circuit or device.
- Use the naming convention approved for your operations team.

## Steps

:::version range="19.0"
1. Open **Configuration > Device Settings > Interfaces**.
2. Select the interface that you want to update.
3. Enter a description that identifies the peer, circuit, or service.
4. Save the running configuration.
:::

:::version range="20.0+"
1. Open **Configuration > Interfaces**.
2. Select the router and interface that you want to update.
3. Enter a description that identifies the peer, circuit, or service.
4. Review the pending configuration.
5. Save and deploy the interface update.
:::

## Verification

Confirm that the interface inventory shows the updated description.
