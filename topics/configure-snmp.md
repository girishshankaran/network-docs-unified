---
topic_id: NET-SNMP-TASK-001
title: Configure SNMP
short_title: Configure SNMP
summary: Configure SNMP access so monitoring systems can collect router health and inventory data.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 9 minutes
permissions: ["administrator"]
tags: ["snmp", "monitoring", "telemetry"]
owner: Network Docs
last_reviewed: "2026-05-01"
lifecycle:
  introduced_in: "19.0"
  updated_in: ["21.0"]
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-snmp
  allow_in_ai_results: true
---

# Configure SNMP

Use this procedure to configure SNMP access for approved monitoring systems.

## Before you begin

- Identify the monitoring system IP addresses.
- Confirm whether your environment uses SNMPv2c or SNMPv3.
- Prepare the required community string or SNMPv3 user credentials.

## Steps

1. Open **Configuration > Monitoring > SNMP**.
2. Select the router or router group.
3. Add the monitoring system as an allowed manager.
4. Configure the SNMP version and credentials.
5. Select the permitted object groups or views.
6. Save and deploy the monitoring configuration.

## Verification

Confirm that the monitoring system can poll router inventory and health data.
