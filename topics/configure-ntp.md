---
topic_id: NET-NTP-TASK-001
title: Configure NTP
short_title: Configure NTP
summary: Configure network time servers so router logs, events, and certificates use synchronized time.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 7 minutes
permissions: ["administrator"]
tags: ["ntp", "time", "system-services"]
owner: Network Docs
last_reviewed: "2026-05-01"
lifecycle:
  introduced_in: "20.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["20.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-ntp
  allow_in_ai_results: true
---

# Configure NTP

Use this procedure to configure network time protocol servers for managed routers.

## Before you begin

- Identify at least two approved NTP servers.
- Confirm the management VRF or source interface that should reach the NTP servers.

## Steps

1. Open **Configuration > System Services > Time**.
2. Click **Add NTP Server**.
3. Enter the NTP server address or host name.
4. Select the source interface or VRF, if required.
5. Set the preferred server option for the primary time source.
6. Save and deploy the configuration.

## Verification

Confirm that the router reports a synchronized time state.
