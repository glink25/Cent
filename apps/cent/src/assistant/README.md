# Assistant

This directory re-exports `@glink25/chaty`. It does not implement a separate model protocol.

Chaty consumes normalized provider chunks with `answer`, optional `thought`, and native `toolCalls`. Plain replies are not parsed as XML. Tools explicitly declare `{ native, code }` exposure and validate input/output through the dispatcher. A session yields full history snapshots with execution status and the currently active tool. An `endsTurn` UI tool ends that model run after its accepted result.

Cent's tools and Code Mode documentation live in `src/agent/README.md`. Zen shares the execution protocol but stores independent `ZenPost` records; changing Chaty must not clear those records.
