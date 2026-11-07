---
name: playground
description: Execute JavaScript to query, aggregate and transform Cent data and invoke host operations.
---

Call discover once to get the current operation schemas. Native playground accepts {code,args?}; code exports a default function, usually async. Call declared code operations as await tools.NAME(args). getFile(index) returns an actual File from this conversation (1-based cumulative index); use await file.text(). No network or DOM access is required.

For annual reports, use tools.aggregate with epoch-millisecond [start,end) bounds and an explicit IANA timezone. Amounts from query/aggregate are integer base currency units at scale 10000; divide once for display. Query items are paginated; statistics cover all matches. Use tools.metadata to resolve category IDs, including widget-generated metadata. Data reads within one execution reuse a snapshot; start a new execution after mutations to refresh it. Return concise computed results; do not return the whole ledger.

For widgets, load cent-principles and the widget skill, generate API 2.0 source, and run tools.validateWidget. Use the installation tool listed by the host. When modifyWidget is available, use action create to propose installation, or action update to revise an existing instance while preserving its storage. Use tools.widgets to inspect installed source. Report cancellation honestly.

Stage multiple writes in one script only when discover lists those operations for Code Mode. Hosts with batch writes show one approval after the script succeeds. A staged result is awaiting approval; report success only after receiving the change receipt.
