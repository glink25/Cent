---
name: widget
description: Build, validate and preview interactive Cent Widget API 2.0 components. Read before writing widget code.
---

Use tools.validateWidget({code}) in playground for preview, then call the native modifyWidget tool with {action:"create",code} to propose installation. New code uses @widget-api 2.0 and export default function Main(ctx). Follow the reference below for state, forms, modals, computed metadata and owned bill edits. Storage holds configuration, never authoritative balances. Existing bills may be referenced in storage but cannot be edited by a different widget. The approval card shows requested permissions. Cancellation is a normal result.
