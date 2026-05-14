---
topic_id: NET-SSH-TASK-002
title: Configure SSH access
short_title: Configure SSH
summary: Enable secure shell access for operational administrators who need command-line connectivity to routers.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 5 minutes
permissions: ["administrator"]
tags: ["ssh", "access", "security"]
owner: Network Docs
last_reviewed: "2026-04-23"
lifecycle:
  introduced_in: "20.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["20.0", "21.0"]
retrieval:
  is_canonical: true
  dedupe_key: configure-ssh-access
  allow_in_ai_results: true
---

# Configure SSH access

Use this procedure to enable SSH access on the router.

## Steps

1. Open **Configuration > Security > Access**.
2. Turn on **SSH Access**.
3. Apply the policy.

## Verification

Confirm that the SSH service shows as enabled in the router access summary.
