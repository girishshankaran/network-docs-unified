---
topic_id: "NET-CONFIGURE-ALERTS-ROUTERS-TASK-001"
title: "Configure Alerts in your Routers"
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
  applies_to: ["21.0"]
retrieval:
  is_canonical: true
  dedupe_key: "configure-alerts-in-your-routers"
  allow_in_ai_results: true
---

# Configure Alerts in your Routers

Use this procedure to configure router alerts for operational events that need operator attention.

## Before you begin

- Identify the routers or router groups that need alert coverage.
- Confirm the notification channel, severity thresholds, and recipients that should be used.

## Steps

1. Open **Operations > Alerts**.
2. Click **Create Alert Policy**.
3. Enter a policy name and select the target router or router group.
4. Select the alert categories to monitor, such as device health, interface state changes, and resource threshold violations.
5. Set the severity level and threshold values that should trigger notifications.
6. Select the notification method and add the required recipients or integration endpoint.
7. Save the alert policy and deploy the configuration.

## Verification

Confirm that the alert policy appears in the alerts summary and that a test or simulated event sends the expected notification.
