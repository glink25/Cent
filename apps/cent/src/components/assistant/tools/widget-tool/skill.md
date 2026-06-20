---
name: widget
description: Author and preview a Cent widget. Use this skill before calling `createWidget` to ensure the generated code follows the Widget DSL contract (header metadata, permissions, config schema, default export, DSL builders).
---

# Widget Skill

Use the `createWidget` tool to open the widget editor with AI-generated code for preview and saving. Before generating code, follow the Widget API reference below to produce valid widgets.

## When to use

- The user asks to create, draft, or prototype a widget
- The user wants to visualize ledger data with a custom small component
- The user wants to iterate on an existing widget idea

## Workflow

1. Read the API reference (embedded below) to understand the available DSL nodes, permissions, data shapes, and config form schema.
2. Write a complete widget source file:
   - Top-of-file JSDoc-style header declaring `@widget-api`, `@name`, and `@permissions`
   - Optional `export const config = { ... }` for user-tunable settings
   - `export default async ({ data, settings, env }) => DSLNode` as the main entry
3. Call the `createWidget` tool with `{ code }` containing the full widget source.
4. The editor opens with a live preview. The user can tweak settings, save, or cancel.

## Output contract

The `createWidget` tool returns `{ saved, cancelled }`:

- `saved: true` — user accepted and persisted the widget
- `cancelled: true` — user dismissed without saving

If cancelled, ask the user what to adjust before re-invoking.

---

# Widget API Reference

The following section is the authoritative Widget API documentation. All generated widget code MUST conform to it.

