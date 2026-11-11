# Cent Assistant integration

The Cent entrance supplies provider configuration and the shared `src/agent/runtime.ts` tool registry to Chaty. Tool definitions declare separate native and code visibility. The chat UI is owned by `packages/chaty` and may evolve with its execution model.

Chaty v4 uses a new chat storage namespace. Old chat history is not replayed. Model settings, ledger data and saved Zen posts remain independent and must not be cleared with chat storage.

The delivery acceptance is the dual-entry annual-report/reimbursement-widget matrix in `docs/.local/v3-agent-plan.md`. A successful preview alone is not acceptance.
