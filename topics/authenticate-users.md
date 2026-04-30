---
topic_id: "NET-AUTHENTICATE-USERS-TASK-001"
title: "Router Authentication Implementation Guide"
short_title: "Router authentication"
summary: "Configure authentication for routers."
product: "Cisco Router Operations Manager"
platform: "IOS-XR routers"
content_type: "task"
audience: ["network-operations", "platform-admin"]
estimated_time: "8 minutes"
permissions: ["administrator"]
tags: ["alerts", "monitoring", "notifications"]
owner: "Network Docs"
last_reviewed: "2026-04-24"
lifecycle:
  introduced_in: "21.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["20.0","21.0"]
retrieval:
  is_canonical: true
  dedupe_key: "configure-auth-in-your-routers"
  allow_in_ai_results: true
---

# Router Authentication Implementation Guide

This guide outlines the standard procedure for configuring **AAA (Authentication, Authorization, and Accounting)** on network routing hardware.

---

## 1. Local Database Setup
Always establish a local administrator account first to ensure access if remote servers are unreachable.
* **Username:** `admin`
* **Privilege Level:** 15 (Full Access)
* **Encryption:** Use `secret` instead of `password` for MD5/SHA hashing.

## 2. Remote Server Configuration
Define the external identity provider (RADIUS or TACACS+).
* **Protocol:** TACACS+ (Recommended for administrative command control).
* **Key:** A strong shared secret between the router and the server.
* **Timeout:** Set a 5-10 second timeout to handle network latency.

## 3. AAA Method Lists
The method list defines the "fallback" logic. 
> **Standard Logic:** `Authentication -> TACACS+ Group -> Local Database`

This sequence ensures that the router attempts to check the central server first, but permits entry via the local `admin` account if the server doesn't respond.

## 4. Secure Transport & Line Config
Apply the authentication policy to all entry points:
* **Console Port:** Requires physical access; usually set to local-only for recovery.
* **VTY Lines (SSH):** Remote access lines. 
* **Protocol Enforcement:** Disable Telnet (`transport input ssh`) to prevent plain-text credential sniffing.

---

## 5. Implementation Sequence (Generic Commands)

1. **Enable AAA:** Activate the model.
2. **Define Server:** Provide IP and Shared Secret.
3. **Create List:** `aaa authentication login default group tacacs+ local`
4. **Assign to Lines:**
    * Enter `line vty 0 4`
    * Apply `login authentication default`
5. **Verify:** Use `show aaa sessions` or `show users`.

---

## ⚠️ Critical Safety Rule
**The "One-Window" Rule:** Keep your current configuration session open. Open a **second** terminal window and attempt to log in using the new credentials. If you are locked out in the second window, fix the config in the first window before exiting.
