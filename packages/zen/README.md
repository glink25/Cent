# @glink25/zen

Standalone Zen experience for React, iframe, Android WebView and iOS WKWebView.
The package owns the Director, journey rules, cards, themes and history UI. The
host owns account data, analysis tools, persistence and real AI requests.

The AI session and native function calling are built on `@glink25/chaty`.

## Consumption

`@glink25/zen` is a source-only workspace package — it is no longer published to
npm. The host app (`apps/cent`) consumes its source directly and provides the
single Tailwind pass, so no `styles.css` import is needed:

```tsx
import { Zen, type ZenRuntimeHost } from "@glink25/zen";

<Zen host={host} onClose={() => setOpen(false)} />;
```

`getInit().theme` controls the light/dark color mode. The optional
`getInit().style` selects a Zen visual style (`default`, `aurora`, `beach`,
`red-moon`, `rain`, or `star-night`). A missing, null, or invalid style keeps
Zen's date-based daily rotation.

For isolated development, the standalone HTML app still works:

```bash
corepack pnpm install
corepack pnpm run dev    # standalone dev server
corepack pnpm run build  # app-dist: standalone HTML app
```

## Two separate protocols

### Component capabilities

These methods are called only by Zen application code. They are never
serialized as model tools:

```ts
type ZenRuntimeHost = {
  getInit(): ZenInitPayload | Promise<ZenInitPayload>;
  getZenContext(args: {
    zenDayId: string;
    focusDecision?: ZenFocusDecision;
  }): Promise<ZenContext>;
  listZenPosts(args?: { limit?: number }): Promise<ZenPost[]>;
  mutateZenPosts(args: { mutations: ZenPostMutation[] }): Promise<void>;
  requestAI(args: ZenAIRequest): ZenRequestHandle | Promise<ZenRequestHandle>;
  callAITool(args: ZenAIToolCall): Promise<unknown>;
};
```

`mutateZenPosts` is invoked when the user saves or forgets a Zen post. The model
cannot discover or invoke it.

### AI tools

`getInit().aiTools` contains host-provided, model-visible tools such as
`queryBills`, `analyzeBills` and `getAccountMeta`. Zen combines them with its
own local tools:

- `showZenStep`: submit one composable form or completion step. Interaction
  steps combine safe content blocks with standard form fields and return a
  structured `{ action, values }` response.
- `decideZenFocus`: select a review period.

Zen registers its card, focus and bounded history tools with the shared
`@glink25/agent-core` session. The host supplies its read-only ledger tools.
The same Playground uses the available tools in Chaty and Zen.

## HTML host discovery

The standalone page checks `window.ZenHost`, then a same-origin parent's
`ZenHost`, then the v4 native agent bridge. Android registers
`window.CentAiChatNative`; iOS uses the WKWebView handler with the same name.
Both use `window.__AIChatNativeCallbacks` for one-shot and streaming responses.

Model requests and tools use the shared `requestAI` and `callTool` messages.
The trusted component uses the `zen` message for starting a review, reading
history, resolving evidence, saving and closing. See the agent-core README
for release pinning and resource verification.

## History behavior

Today, history list and history detail are views inside the same `Zen`
component. Entering history replaces the current view and returning restores
the current Zen state; no second host dialog is opened.
