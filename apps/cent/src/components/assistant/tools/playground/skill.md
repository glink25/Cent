---
name: playground
description: Execute JavaScript to query, aggregate and transform Cent data and invoke host operations.
---

Call discover once to get the current operation schemas. Native playground accepts {code,args?}; code exports a default function, usually async. Call declared code operations as await tools.NAME(args). getFile(index) returns an actual File from this conversation (1-based cumulative index); use await file.text(). No network or DOM access is required.

For annual reports, use tools.aggregate with epoch-millisecond [start,end) bounds and an explicit IANA timezone. Amounts from query/aggregate are integer base currency units at scale 10000; divide once for display. Query items are paginated; statistics cover all matches. Use tools.metadata to resolve category IDs, including widget-generated metadata. Data reads within one execution reuse a snapshot; start a new execution after mutations to refresh it. Return concise computed results; do not return the whole ledger.

For widgets, load the widget skill, generate API 2.0 source, run tools.validateWidget, then call the native modifyWidget tool to propose creation. Report cancellation honestly. Use tools.widgets to inspect installed source and native modifyWidget with action update to revise an existing instance while preserving its storage.

Multiple writes can be staged by awaiting tools.importBills, tools.modifyBills, tools.modifyWidget or tools.editLedgerMetadata inside a single script. The host displays one batch approval after the script succeeds. The script sees staged status; report success only from the resulting change receipt.
