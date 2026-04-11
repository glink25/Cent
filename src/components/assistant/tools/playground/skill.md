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

## Output

- `success: true` with `result` when execution succeeds
- `success: false` with `error` when parsing/execution/timeout fails

## Notes

- Keep snippets small and deterministic
- Avoid depending on blocked globals (network, timers, DOM, dynamic eval)
- Use `getFile(index)` when you need to parse or inspect user-uploaded files
