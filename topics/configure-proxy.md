---
topic_id: NET-PROXY-TASK-001
title: Configure proxy on a router
short_title: Configure proxy
summary: Configure outbound proxy settings for router-initiated traffic and software retrieval.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "security-admin"]
estimated_time: 8 minutes
permissions: ["administrator"]
tags: ["proxy", "egress", "network-services"]
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
  dedupe_key: configure-router-proxy
  allow_in_ai_results: true
---

# Configure proxy on a router

Use this procedure to configure a proxy server for router traffic in release 20.0.

## Steps

1. Open **Configuration > Network Services > Proxy**.
2. Enable **Use Proxy Server**.
3. Enter the proxy host name or IP address.
4. Enter the proxy port.
5. If authentication is required, enter the user name and password.
6. Save and deploy the configuration.
