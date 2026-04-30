---
topic_id: "NET-GENERATE-SSH-KEYS-TASK-001"
title: "Generate SSH keys"
short_title: "Generate SSH keys"
summary: "Generate SSH key material for secure administrative access to managed routers."
product: "Cisco Router Operations Manager"
platform: "IOS-XR routers"
content_type: "task"
audience: ["network-operations", "platform-admin"]
estimated_time: "7 minutes"
permissions: ["administrator"]
tags: ["ssh", "keys", "security"]
owner: "Network Docs"
last_reviewed: "2026-04-24"
lifecycle:
  introduced_in: "19.0"
  updated_in: ["20.0"]
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "20.0"]
retrieval:
  is_canonical: true
  dedupe_key: "generate-ssh-keys"
  allow_in_ai_results: true
---

# Generate SSH keys

Use this procedure to create SSH key material before enabling secure administrative access to routers.

## Before you begin

- Confirm that you have administrator permissions for the target router or router group.
- Decide whether the key is for device host identity, administrator login, or an automation account.
- Store private keys only in an approved secure location.

## Steps

1. Open **Configuration > Security > SSH Keys**.
2. Click **Generate Key**.
3. Enter a key name that identifies the router, site, or automation account.
4. Select the key type and size approved by your security policy.
5. Add an optional passphrase if the key will be exported for administrator or automation use.
6. Click **Generate**.
7. Copy or download the public key and register it with the target router or access policy.
8. Save the configuration.

## Verification

Confirm that the key appears in the SSH key inventory and that a test SSH session uses the new key successfully.
