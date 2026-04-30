---
topic_id: "NET-SWITCH-AUTHENTICATION-TASK-001"
title: "Configure Auth in switches"
short_title: "Configure Alerts"
summary: "Configure router alerts so operators are notified when health, interface, or threshold conditions require action."
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
  dedupe_key: "configure-alerts-in-your-routers"
  allow_in_ai_results: true
---

## 1. Management Plane Security (AAA)
Secure the "brain" of the switch by defining how administrators log in.

* **Local Account:** Create a "break-glass" account with a strong secret.
* **Method List:** Define a login sequence that prioritizes centralized servers (TACACS+/RADIUS) but falls back to the local database if the server is down.
* **Command Authorization:** Unlike routers, switch admins often need granular permission levels. Use TACACS+ to authorize specific commands based on the user's role.

## 2. Infrastructure Hardening
Unlike routers, switches have a large "surface area" of physical ports.
* **Management VLAN:** Never use the default 'VLAN 1' for management. Assign an IP to a dedicated, tagged VLAN (e.g., VLAN 99).
* **VTY Security:** Restrict SSH access to specific source IPs using an Access Control List (ACL).
* **Timeout:** Set an `exec-timeout` (e.g., 5 minutes) to automatically log out idle sessions.

## 3. Port-Level Authentication (IEEE 802.1X)
This ensures that a device (PC, Phone, IoT) cannot send traffic until it authenticates.
* **Supplicant:** The device attempting to connect.
* **Authenticator:** The Switch.
* **Authentication Server:** Usually a RADIUS server (like Cisco ISE or Aruba ClearPass).
* **Fallback:** Configure "MAC Authentication Bypass" (MAB) for devices like printers that don't support 802.1X.

---

## 4. Implementation Steps

| Sequence | Task | Key Command Logic |
| :--- | :--- | :--- |
| **Step 1** | **Global AAA** | `aaa new-model` |
| **Step 2** | **Server Group** | Define RADIUS/TACACS+ server IPs and keys. |
| **Step 3** | **SSH Setup** | Generate RSA keys and set `transport input ssh`. |
| **Step 4** | **802.1X Enable** | `dot1x system-auth-control` (to secure physical ports). |
| **Step 5** | **Port Config** | Set ports to `authentication port-control auto`. |

---
