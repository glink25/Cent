---
name: playground
description: Run JavaScript, work with conversation files, and invoke host operations.
---

Call discover once to get the current operation schemas. Native playground accepts {code,args?}; code exports a default function, usually async. Call declared code operations as await tools.NAME(args). getFile(index) returns an actual File from this conversation (1-based cumulative index); use await file.text(). No network or DOM access is required.

In Chaty conversations, await fs.list() to find drafts and await fs.read(path, {start, end}) to read an optional zero-based UTF-16 range (end exclusive). Use await fs.write(path, text), await fs.replace(path, oldText, newText) for one exact match, and await fs.remove(path). Use relative paths and UTF-8 text. Files are available across turns. Pass a file to a host call as its argument and return a short receipt instead of returning the file text to the model.

When the host is Cent, for annual reports, use tools.aggregate with epoch-millisecond [start,end) bounds and an explicit IANA timezone. Amounts from query/aggregate are integer base currency units at scale 10000; divide once for display. Query items are paginated; statistics cover all matches. Use tools.metadata to resolve category IDs, including widget-generated metadata. Data reads within one execution reuse a snapshot; start a new execution after mutations to refresh it. Return concise computed results; do not return the whole ledger.

In Cent, for widgets, load cent-principles and the widget skill, generate API 2.0 source, and run tools.validateWidget. Use the installation tool listed by the host. When modifyWidget is available, use action create to propose installation, or action update to revise an existing instance while preserving its storage. Use tools.widgets to inspect installed source. Report cancellation honestly.

Stage multiple writes in one script only when discover lists those operations for Code Mode. Hosts with batch writes show one approval after the script succeeds. A staged result is awaiting approval; report success only after receiving the change receipt.
