---
topic_id: NET-INSTALL-IMAGES-ROUTERS-TASK-001
title: Install images on your routers
short_title: Install images
summary: Install approved software images on managed routers before activation or deployment.
product: Cisco Router Operations Manager
platform: IOS-XR routers
content_type: task
audience: ["network-operations", "platform-admin"]
estimated_time: 12 minutes
permissions: ["administrator"]
tags: ["software", "images", "installation", "maintenance"]
owner: Network Docs
last_reviewed: "2026-05-04"
lifecycle:
  introduced_in: "19.0"
  updated_in: []
  deprecated_in: null
  status: active
  replaced_by: null
  applies_to: ["19.0", "20.0"]
retrieval:
  is_canonical: true
  dedupe_key: install-images-on-your-routers
  allow_in_ai_results: true
---

# Install images on your routers

Use this procedure to install approved software images on managed routers before activation or deployment.

## Before you begin

- Download the approved image package for the target router model.
- Verify the image checksum and compatibility information.
- Confirm that each router has enough available storage for the image.
- Schedule a maintenance window if the installation is part of a software change.

## Steps

1. Open **Administration > Software Management**.
2. Click **Upload Image** and select the approved image package.
3. Wait for checksum validation to complete.
4. Review the image version, platform, and compatibility details.
5. Select the routers or router group that need the image.
6. Click **Install Image**.
7. Monitor the installation progress until each router reports a completed status.

## Verification

Confirm that the image appears in the router software inventory and that each selected router reports the image as installed.
