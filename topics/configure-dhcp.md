---
topic_id: NET-DHCP-TASK-001
title: Configure DHCP on a router
short_title: Configure DHCP
summary: Configure the router to provide DHCP scopes and address leases for branch subnets.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 10 minutes
permissions: ["administrator"]
tags: ["dhcp", "address-management", "lan-services"]
owner: Network Docs
last_reviewed: "2026-04-23"
lifecycle:
  introduced_in: "21.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-router-dhcp
  allow_in_ai_results: true
---

# Configure DHCP on a router

Use this procedure to configure the router as a DHCP server for release 21.0.

## Before you begin

- Identify the interface or VLAN where the DHCP scope will be applied.
- Confirm the address range, default gateway, and DNS server values for the subnet.

## Steps

1. Open **Configuration > Network Services > DHCP**.
2. Click **Add DHCP Scope**.
3. Enter a scope name and select the target interface.
4. Enter the start and end IP addresses for the lease pool.
5. Enter the subnet mask, default gateway, and DNS server values.
6. Set the lease duration for client devices.
7. Save and deploy the configuration.

## Verification

Confirm that the DHCP scope appears in the services summary and that clients on the target network receive addresses from the configured pool.
