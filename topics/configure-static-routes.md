---
topic_id: NET-STATIC-ROUTES-TASK-001
title: Configure static routes
short_title: Configure static routes
summary: Add static routes for branch, management, or service networks that require fixed next-hop forwarding.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 8 minutes
permissions: ["administrator"]
tags: ["routing", "static-routes", "configuration"]
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
  dedupe_key: configure-static-routes
  allow_in_ai_results: true
---

# Configure static routes

Use this procedure to add static routes for networks that require a fixed next hop.

## Before you begin

- Confirm the destination prefix, subnet mask, and next-hop address.
- Verify that the next hop is reachable from the selected router.

## Steps

1. Open **Configuration > Routing > Static Routes**.
2. Click **Add Static Route**.
3. Enter the destination prefix and subnet mask.
4. Enter the next-hop address or outgoing interface.
5. Add an optional route description.
6. Save and deploy the route configuration.

## Verification

Confirm that the route appears in the routing table and traffic uses the expected next hop.
