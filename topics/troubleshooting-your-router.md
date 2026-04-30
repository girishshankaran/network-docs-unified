---
topic_id: NET-TROUBLESHOOTING-ROUTER-TASK-001
title: Troubleshooting your router
short_title: Troubleshoot router
summary: Diagnose router connectivity, interface, and health issues before escalating to support.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 12 minutes
permissions: ["administrator"]
tags: ["troubleshooting", "diagnostics", "router-health"]
owner: Network Docs
last_reviewed: "2026-04-30"
lifecycle:
  introduced_in: "19.0"
  updated_in: ["21.0"]
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: troubleshooting-your-router
  allow_in_ai_results: true
---

# Troubleshooting your router

Use this procedure to isolate common router issues before you open a support case.

## Before you begin

- Confirm that you have administrator access to the affected router.
- Identify the router name, management address, site, and the time the issue started.
- Check whether a planned maintenance window, software change, or configuration deployment is in progress.

## Steps

1. Open **Inventory > Routers** and select the affected router.
2. Check the router health state, last contact time, and active alarms.
3. Review interface status for administratively down, operationally down, or high error-rate interfaces.
4. Open **Diagnostics > Connectivity Test** and run a reachability check to the router management address.
5. Review the latest configuration deployment or software activity for failures.
6. If the router is reachable, collect diagnostics from **Actions > Collect Support Bundle**.
7. If the router is not reachable, verify upstream connectivity, power, and out-of-band console access.

## Verification

Confirm that the router returns to an `Up` state, active alarms are cleared or acknowledged, and affected interfaces show the expected operational state.

## Escalation details

When escalation is required, include the router name, release version, active alarms, recent activity, and the collected support bundle.
