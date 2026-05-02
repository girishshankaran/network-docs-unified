---
topic_id: NET-DNS-TASK-001
title: Configure DNS servers
short_title: Configure DNS servers
summary: Configure DNS servers so routers can resolve hostnames for management and service integrations.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 8 minutes
permissions: ["administrator"]
tags: ["dns", "network-services", "configuration"]
owner: Network Docs
last_reviewed: "2026-05-02"
lifecycle:
  introduced_in: "19.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "20.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-dns-servers
  allow_in_ai_results: true
---

# Configure DNS servers

Use this procedure to configure DNS servers for router hostname resolution.

## Before you begin

- Identify the primary and secondary DNS server IP addresses.
- Confirm that the routers can reach the DNS servers through the management network.
- Verify the domain search suffixes required by your environment.

## Steps

1. Open **Configuration > Network Services > DNS**.
2. Select the router or router group.
3. Enter the primary DNS server address.
4. Add a secondary DNS server address for redundancy.
5. Add the required domain search suffixes.
6. Save and deploy the DNS configuration.

## Verification

Confirm that the router can resolve hostnames for management services, logging destinations, and external integrations.
