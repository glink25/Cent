# chaty

Standalone AI chat frontend. The app owns the chat UI, assistant core,
conversation persistence, native `listSkills` / `loadSkill` tools, and the
sandboxed `playground` tool.

The host owns model credentials, real API requests, injected tools, and injected
skills.

## Tool calling

Tool calling uses the **native function/tool-calling protocol**, not a custom
text format. On each turn the app serializes every available tool (app-native +
host-injected) to JSON Schema and passes them to `requestAI` via `tools`. The
host forwards these as the underlying model API's native `tools` field, and
returns the model's tool calls back through `onChunk` as `chunk.toolCalls`
(with `chunk.finishReason === "tool_calls"`). The app then executes each call —
app-native tools run locally, injected tools go back to the host via `callTool`
— and feeds the results into the next turn. `<overview>` titles are still parsed
from streamed text; only tool calling moved to the native protocol.

```ts
type ProviderToolCall = { id: string; name: string; params: unknown };

type ProviderRequestChunk = {
  thought?: string;
  answer: string;
  // Populated only once the stream resolves tool calls (typically a final chunk).
  toolCalls?: ProviderToolCall[];
  finishReason?: "stop" | "tool_calls" | "length" | string;
};
```

## Run

```bash
corepack pnpm install
corepack pnpm run dev
```

- App entry: `http://localhost:2271/`
- Debug host entry (Web / iframe): `http://localhost:2271/test.html`
- Debug host entry (Native bridge): `http://localhost:2271/native-test.html`
  (append `?bridge=ios` to simulate iOS WKWebView instead of Android WebView)

`test.html` embeds the app in an iframe and injects:

- A virtual streaming provider that returns `这是测试输出：` plus the latest user
  input.
- Test tools: `echo`, `sumNumbers`, `getDebugContext`.
- Test skills: `test-skill`, `lazy-test-skill`.

`native-test.html` mounts the app directly (no iframe) and mocks an Android /
iOS native bridge through the same protocol real native hosts use.

## Host Bridge

The app consumes a single standard `HostBridge`. Platform differences are
isolated in the host adapter layer (`src/chaty/host.ts` +
`src/chaty/native-host.ts`); the chat core, assistant core, tool execution,
and UI never see them.

The bridge is discovered in this order — the first match wins:

```ts
window.AIChatHost                    // 1. Web: same-window injection
  ?? getSameOriginParentHost()       // 2. iframe: same-origin window.parent.AIChatHost
  ?? getAndroidNativeHost()          // 3. Android WebView: window.CentAiChatNative
  ?? getIosNativeHost();             // 4. iOS WKWebView: window.webkit.messageHandlers.CentAiChatNative
```

Adding a new JS bridge backend means adding one more adapter to the chain — no
changes to the assistant core.

### 1–2. Web / iframe injection

The app reads a same-origin host bridge from `window.AIChatHost`, or from
`window.parent.AIChatHost` when embedded in an iframe.

```ts
type AIChatInitPayload = {
  configs: Array<{ id: string; name: string }>;
  // Defaults to the first config when omitted.
  defaultConfigId?: string;
  systemPrompt: string;
  presetPrompts: Array<{ id: string; label: string; prompt: string }>;
  tools: Array<{
    name: string;
    describe: string;
    argJsonSchema?: Record<string, unknown>;
    returnJsonSchema: Record<string, unknown>;
  }>;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    content?: string;
  }>;
  locale?: "zh" | "en";
  theme?: "light" | "dark" | "system";
};

type HostBridge = {
  getInit?: () => AIChatInitPayload | Promise<AIChatInitPayload>;
  requestAI(args: {
    requestId: string;
    configId?: string;
    history: History;
    // Every tool available this turn (app-native + injected), serialized to
    // JSON Schema. Forward these as the model API's native `tools` field.
    tools: Array<{
      name: string;
      describe: string;
      argJsonSchema?: Record<string, unknown>;
      returnJsonSchema: Record<string, unknown>;
    }>;
    // Stream text via onChunk({ answer }). To call tools, emit a chunk with
    // toolCalls: onChunk({ answer: "", toolCalls, finishReason: "tool_calls" }).
    onChunk: (chunk: ProviderRequestChunk) => void;
    onDone: () => void;
    onError: (error: unknown) => void;
  }): { cancel: () => void } | Promise<{ cancel: () => void }>;
  callTool(args: {
    callId: string;
    name: string;
    params: unknown;
    history: History;
  }): Promise<unknown>;
  loadSkill?(args: { id: string }): Promise<{
    id: string;
    name: string;
    description: string;
    content?: string;
  }>;
};
```

### 3–4. Native injection (Android / iOS)

Native hosts do **not** implement `HostBridge` directly. Instead they expose a
thin message channel and the app's native adapter wraps it into a standard
`HostBridge`. This keeps a single protocol across platforms and matches the
one-way async `postMessage` constraint of WKWebView (so Android and iOS share
the same async callback protocol — Android's ability to return synchronously is
treated as an internal detail only).

**JS → Native messages** (the app sends these):

```ts
type NativeBridgeMessage =
  | { id: string; type: "getInit" }
  | { id: string; type: "requestAI";
      payload: { requestId: string; configId?: string; history: History;
                 tools: AIChatToolDefinition[] } }
  | { id: string; type: "cancelRequest";
      payload: { requestId: string } }
  | { id: string; type: "callTool";
      payload: { callId: string; name: string; params: unknown; history: History } };
```

**Native → JS callbacks** (native invokes these via `evaluateJavascript` /
`evaluateJavaScript`). The app registers a callback object per message `id` on
`window.__AIChatNativeCallbacks`:

```js
window.__AIChatNativeCallbacks[id].resolve(payload)      // getInit / callTool result
window.__AIChatNativeCallbacks[id].reject({ message })   // getInit / callTool error
window.__AIChatNativeCallbacks[id].onChunk({ answer })   // requestAI streaming text chunk
window.__AIChatNativeCallbacks[id].onChunk({ answer: "", toolCalls, finishReason: "tool_calls" }) // requestAI tool call
window.__AIChatNativeCallbacks[id].onDone()              // requestAI finished
window.__AIChatNativeCallbacks[id].onError({ message })  // requestAI failed
```

Lifecycle per message type:

- `getInit` → native replies once with `resolve(AIChatInitPayload)`.
- `requestAI` → native streams `onChunk(...)` zero or more times (text via
  `{ answer }`, or a tool call via `{ answer, toolCalls, finishReason: "tool_calls" }`),
  then exactly one of `onDone()` / `onError(...)`. A later `cancelRequest` (same
  `requestId`) means the app stopped listening; native should stop streaming.
- `callTool` → native replies once with `resolve(result)` or `reject({ message })`.
- `cancelRequest` → fire-and-forget; no callback expected.

#### Android WebView

Expose a JavaScript interface named `CentAiChatNative` whose `postMessage`
receives a **JSON string**:

```kotlin
// Inject before the page scripts run.
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun postMessage(messageJson: String) {
        val message = JSONObject(messageJson)
        // dispatch by message.getString("type") ...
    }
}, "CentAiChatNative")
```

Call back into the page from the UI thread:

```kotlin
val js = "window.__AIChatNativeCallbacks['$id'].onChunk(${chunkJson});"
webView.post { webView.evaluateJavascript(js, null) }
```

The app sends `window.CentAiChatNative.postMessage(JSON.stringify(message))`.
No wrapper iframe is needed — `loadUrl("http://localhost:2271/")` works directly.

#### iOS WKWebView

Register a message handler named `CentAiChatNative`. Its `postMessage` receives a
**JS object** (already decoded by WKWebView, no `JSON.parse` needed):

```swift
let controller = webView.configuration.userContentController
controller.add(self, name: "CentAiChatNative")

func userContentController(_ controller: WKUserContentController,
                           didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any] else { return }
    // dispatch by body["type"] ...
}
```

Call back into the page:

```swift
let js = "window.__AIChatNativeCallbacks['\(id)'].onChunk(\(chunkJson));"
webView.evaluateJavaScript(js, completionHandler: nil)
```

The app sends `window.webkit.messageHandlers.CentAiChatNative.postMessage(message)`.
Injecting only this message handler plus the callback JS is enough to complete
init, streaming responses, tool calls, and cancellation.

> Native error payloads are normalized to a JS `Error`: an object with a
> `message` field is preferred, otherwise the value is stringified.

## Debug Protocol

Without a real model, `test.html` / `native-test.html` can still exercise the
assistant core. The debug host parses `<tool>{...}</tool>` text from the latest
user message and translates it into a native `toolCalls` chunk — i.e. the mock
plays the role the model API plays in production. Send any of these in the chat
input:

```xml
<tool>{"name":"sumNumbers","params":{"values":[1,2,3]}}</tool>
```

```xml
<tool>{"name":"listSkills","params":{}}</tool>
```

```xml
<tool>{"name":"loadSkill","params":{"id":"lazy-test-skill"}}</tool>
```

```xml
<tool>{"name":"playground","params":{"code":"export default async function () { return await tools.echo({ text: 'from playground' }); }"}}</tool>
```

## Build

```bash
corepack pnpm run lint
corepack pnpm run build
```
