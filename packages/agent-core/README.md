# Agent core

The workspace package owns the conversation loop, tool calls and context management. The default entry can be loaded without React or a browser. The provider, host bridge and browser Playground have separate entry points.

Web, iOS and Android share the ledger schemas in `src/ledger-tools.ts` and the cases in `contracts/ledger-fixtures.json`. Native hosts keep their own ledger and approval implementations. The bundled adapters replace the public schemas of registered native ledger tools with the shared definitions while respecting native exposure flags.

## Bundled release

1. Commit the Web implementation and check out the same clean revision for both native builds.
2. Point the iOS `web` gitlink and Android `scripts/cent-web-revision` at that revision.
3. Run `CENT_WEB_CHECKOUT=/path/to/cent bash scripts/build-ai-web.sh` in each native project using Node 22.18 or later. Commit the bundled Chaty, Zen and Assistant resources with the native changes.
4. Verify each manifest in release mode. The verifier checks bridge v4, the pinned revision, and SHA-256 hashes for the embedded pages and tool contract. A working-tree build can be used for development and fails the release check.

Both native views register `CentAiChatNative` and use the same streaming and tool callbacks. The trusted Zen UI can send the `zen` component operation for opening, reading history, resolving evidence, saving or closing. Model calls use the shared `callTool` path and a read-only allowlist for Zen.
