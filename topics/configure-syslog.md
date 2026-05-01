---
topic_id: NET-SYSLOG-TASK-001
title: Configure syslog forwarding
short_title: Configure syslog
summary: Forward router system messages to a centralized logging platform for operations and audit review.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 8 minutes
permissions: ["administrator"]
tags: ["syslog", "logging", "monitoring"]
owner: Network Docs
last_reviewed: "2026-05-01"
lifecycle:
  introduced_in: "21.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-syslog-forwarding
  allow_in_ai_results: true
---

# Configure syslog forwarding

Use this procedure to forward router messages to a centralized logging platform.

## Before you begin

- Identify the syslog server address and transport port.
- Confirm the minimum severity level that should be forwarded.
- Verify that the router can reach the logging platform.

## Steps

1. Open **Configuration > Monitoring > Logging**.
2. Click **Add Syslog Destination**.
3. Enter the syslog server address and port.
4. Select the minimum severity level to forward.
5. Choose the source interface or management VRF.
6. Save and deploy the logging configuration.

## Verification

Confirm that the logging platform receives test messages from the router.
