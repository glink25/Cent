---
name: playground
description: Use a sandboxed JavaScript worker to execute small snippets for calculation, data shaping, and behavior verification.
---

# Playground Tool

`playground` lets the assistant run JavaScript module code in an isolated web-worker sandbox.

## When to use

- Quick calculations that are easier to validate with code
- Data transformation checks (map/filter/reduce/grouping)
- Small logic experiments before writing production code

## Input contract

The tool expects:

- `code` (required): JavaScript module source code
- `args` (optional): array of arguments passed to default export
- `timeoutMs` (optional): execution timeout, default is `2000`
- `whiteList` (optional): allowed global APIs inside sandbox

The runtime also injects a global helper:

- `getFile(index)` (1-based): get uploaded file payload from the current session history

`getFile(index)` returns:

- `index`: file index (starts from `1`)
- `name`: original filename
- `type`: MIME type
- `size`: file size (bytes)
- `lastModified`: file timestamp
- `text`: file text content

> ⚠️ **Important: always limit the length of the returned text to reduce token consumption.** `text` can be very large. When calling the tool, make sure the processing (slicing, filtering, aggregating, counting) happens inside the snippet and only return the necessary result instead of the whole text. Read and return the full file content only when it is truly necessary.

`code` must export a default function:

```js
export default function main(input) {
  return { ok: true, size: Array.isArray(input) ? input.length : 0 };
}
```

## Example call

```json
{
  "name": "playground",
  "params": {
    "code": "export default function () { const file = getFile(1); return { fileName: file?.name ?? null, first20: file?.text?.slice(0, 20) ?? null }; }"
  }
}
```

## Invoking other tools

The runtime also injects a global async `tools` object. Every other tool registered in this
session is available as `tools.<toolName>(params)` and returns a Promise:

- `params` must match that tool's argument schema (see `listTools`).
- It resolves with the tool's return value (matching its return schema), or rejects with an error.
- Calls made through `tools` do **not** appear in the conversation — they are internal to this
  playground run (just like `getFile`), so they do not consume context tokens.
- `playground` cannot call itself.

This lets you compute a payload and act on it in a single snippet, instead of emitting a large
payload as a separate tool call. Example — build bills and import them directly:

```js
export default async function () {
  const meta = await tools.getAccountMeta();
  const items = [
    { id: "1", type: "expense", categoryId: meta.categories[0].id, creatorId: 0,
      amount: 123400, time: Date.now() },
  ];
  const res = await tools.importBills({ items, meta: {} });
  return res; // { ok: true, imported: 1, strategy: "append" } 等
}
```

## Output

- `success: true` with `result` when execution succeeds
- `success: false` with `error` when parsing/execution/timeout fails

## Notes

- Keep snippets small and deterministic
- Avoid depending on blocked globals (network, timers, DOM, dynamic eval)
- Use `getFile(index)` when you need to parse or inspect user-uploaded files
