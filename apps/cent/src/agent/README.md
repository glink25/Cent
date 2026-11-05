# Cent Agent runtime

The internal Assistant and external Agent API share `runtime.ts`. `operations.ts` defines read operations against an injected `AgentDataHost`; `web-host.ts` binds storage and computes widget metadata. Widget preview/editor actions currently use the existing Web host UI.

## Tools

- `discover`: native and code. Lists code operations and JSON schemas.
- `playground`: native only. Runs an ES module exporting a default function; `tools.NAME(args)` calls declared code operations.
- Internal sessions also expose `listSkills` / `loadSkill`. External sessions expose `readDocs`.
- Query, aggregate, metadata, widget inspection/validation, import and widget editor actions are code-only.

`Tool.exposure` controls native and code independently. Undeclared exposure is closed. Host bridges must validate the surface and schemas; the tool list alone is not an authorization boundary. `effect` controls replay eligibility; arbitrary code execution cannot be automatically replayed as read-only.

## Data contract

`query` returns real integer bill amounts, scaled 10000:1. `filter.start` is inclusive and `filter.end` exclusive, both epoch milliseconds. `categoryIds` and `tagIds` are exact IDs; an explicitly empty array matches nothing. `offset` / `limit` page the items, while statistics cover every match. `aggregate` uses the same filter and accepts an IANA time zone for month buckets. Opaque tags do not affect totals.

A code invocation shares its first read snapshot across queries. New invocations refresh data. Return summaries rather than unbounded rows to the model. This snapshot does not provide cross-operation transactional writes.

## Widget workflow

Load the `widget` manual, use API 2.0, validate with `validateWidget`, then native `modifyWidget`. Validation runs render/computed only; it is not proof that all interaction handlers work. The change card shows the diff and requested permissions before committing. Updates retain instance ID and storage. Installed source is available through `widgets`.

## Migration and validation

Chaty uses a new IndexedDB namespace; no old chat protocol is replayed. ZenPost storage is not cleared or migrated. Its legacy steps/cardSummaries are projected for display without rewriting source data.

Run Chaty and Zen tests, Cent typecheck, production build, and `node --test apps/cent/scripts/agent-data.test.mjs`. Release acceptance additionally requires the four real tasks in `docs/.local/v3-agent-plan.md`: internal Assistant and Codex computer use each independently complete an annual report and an interactive reimbursement widget. Unit tests do not replace those tasks.

## Remaining implementation limitations

- General bill update/delete, widget removal API, persistent request deduplication remain to be completed. Agent writes are serialized per ledger within this page.
- Computed metadata is currently awaited in the agent Web host separately from the UI hook; unifying that service remains pending.
- Worker execution retains the existing isolation architecture and RPC-wait timeout policy; hardening and complete progress/cancellation propagation require further work.
- Chaty has turn grouping and active-tool state; rich host result cards and detailed child RPC activity are pending.
- Native Zen bridge clients require real platform verification. Existing saved content is covered by read-only projection tests, not a full synchronization round-trip test.
