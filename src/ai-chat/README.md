# ai-chat.html Host Integration

`ai-chat.html` is a standalone AI chat web UI. It is designed to be embedded by
Web, iOS, and Android hosts without storing model configuration or making AI API
requests by itself.

## Ownership Boundary

`ai-chat.html` owns:

- Chat UI, message rendering, model selector UI, presets, file picker UI.
- Chat history and uploaded files in its own IndexedDB namespace.
- Native tools that are safe to run inside the page, currently `playground`.
- Tool/skill orchestration through the local ai-chat core.

The host owns:

- API keys, API base URLs, model names, and provider-specific request bodies.
- System prompt and preset prompt injection.
- AI request execution, streaming, errors, and cancellation.
- Host tools and host skill content.

`ai-chat.html` must not persist API keys, model configuration, system prompts,
tool handlers, or skill handlers.

## Public Types

The public protocol lives in `src/ai-chat/types.ts`.

```ts
type AIChatInitPayload = {
  configs: Array<{ id: string; name: string }>;
  defaultConfigId?: string;
  systemPrompt: string;
  presetPrompts: Array<{ id: string; label: string; prompt: string }>;
  tools: AIChatToolDefinition[];
  skills: AIChatSkillDefinition[];
  locale?: "zh" | "en";
  theme?: "light" | "dark" | "system";
};

type HostBridge = {
  getInit?: () => AIChatInitPayload | Promise<AIChatInitPayload>;
  requestAI(args: RequestAIArgs): HostRequestHandle | Promise<HostRequestHandle>;
  callTool(args: ToolCallArgs): Promise<unknown>;
  loadSkill?(args: { id: string }): Promise<AIChatSkillDefinition>;
};

type HostRequestHandle = {
  cancel: () => void;
};
```

## Lifecycle

1. Host loads `/ai-chat.html` in an iframe or WebView.
2. `ai-chat.html` resolves a host bridge:
   - `window.CentAIChatHost`, when injected directly.
   - otherwise `postMessage`, by sending `cent-ai-chat:init-request`.
3. Host returns `AIChatInitPayload`.
4. User sends a message.
5. `ai-chat.html` calls host `requestAI` with selected `configId` and full
   conversation `history`.
6. Host streams cumulative chunks back to ai-chat.
7. If the user stops generation, ai-chat calls the current request handle's
   `cancel()`.
8. If the model calls a tool or skill, ai-chat forwards it to the host.

## Streaming Contract

Chunks are cumulative, matching the local parser expectation:

```ts
type ProviderRequestChunk = {
  thought?: string;
  answer: string;
};
```

For `postMessage`, host sends:

```ts
{ type: "cent-ai-chat:request-chunk", requestId, chunk }
{ type: "cent-ai-chat:request-done", requestId }
{ type: "cent-ai-chat:request-error", requestId, error }
```

Cancellation is request-scoped:

```ts
const handle = host.requestAI(args);
handle.cancel();
```

For `postMessage`, ai-chat sends:

```ts
{ type: "cent-ai-chat:request-cancel", requestId }
```

The host maps this to its own `AbortController`, native task cancellation, or
provider-specific cancel token.

## Tools

Host tools are injected as metadata:

```ts
type AIChatToolDefinition = {
  name: string;
  describe: string;
  argJsonSchema?: Record<string, unknown>;
  returnJsonSchema: Record<string, unknown>;
};
```

When the assistant calls a tool, ai-chat calls:

```ts
host.callTool({
  callId,
  name,
  params,
  history,
});
```

The native `playground` tool can run JavaScript in a worker. Inside playground
code, host tools are available as functions:

```js
export default async function () {
  const data = await tools.queryBills({ startTime: "2026-01-01" });
  return data.statistics;
}
```

Those calls still go through `host.callTool`; the worker never receives direct
access to host objects.

## Skills

Skills are injected as metadata and optional content:

```ts
type AIChatSkillDefinition = {
  id: string;
  name: string;
  description: string;
  content?: string;
};
```

If `content` is omitted, ai-chat calls:

```ts
host.loadSkill?.({ id });
```

The loaded result should include `content`.

## Web iframe Example

The current Web host implementation is `src/ai-chat/frame.tsx`. It demonstrates:

- injecting model names and ids only;
- proxying AI API requests from the parent page;
- forwarding stream chunks to the iframe;
- returning a per-request cancel handle;
- exposing ledger/widget tools;
- exposing skills and lazy skill loading.

Minimal direct-injection example:

```ts
window.CentAIChatHost = {
  async getInit() {
    return {
      configs: [{ id: "default", name: "Default model" }],
      defaultConfigId: "default",
      systemPrompt: "You are a helpful assistant.",
      presetPrompts: [{ id: "hello", label: "Hello", prompt: "Hello" }],
      tools: [
        {
          name: "getEnv",
          describe: "Return current environment.",
          argJsonSchema: {},
          returnJsonSchema: { type: "string" },
        },
      ],
      skills: [
        {
          id: "example",
          name: "Example Skill",
          description: "How to use the host.",
          content: "Use getEnv before answering current-state questions.",
        },
      ],
    };
  },

  requestAI({ requestId, configId, history, onChunk, onDone, onError }) {
    const controller = new AbortController();

    fetch("/host/ai/stream", {
      method: "POST",
      body: JSON.stringify({ requestId, configId, history }),
      signal: controller.signal,
    })
      .then(async (response) => {
        for await (const chunk of parseHostStream(response)) {
          onChunk(chunk);
        }
        onDone();
      })
      .catch((error) => {
        if (!controller.signal.aborted) onError(error);
      });

    return {
      cancel: () => controller.abort(),
    };
  },

  async callTool({ name, params }) {
    if (name === "getEnv") return new Date().toISOString();
    throw new Error(`Unknown tool: ${name}`);
  },
};
```

## iOS WKWebView Example

Recommended shape:

1. Inject a small JavaScript bridge before loading `ai-chat.html`.
2. Forward bridge messages to Swift through `window.webkit.messageHandlers`.
3. Swift executes AI requests/tools/skills and calls JavaScript to deliver
   chunks/results.

JavaScript side:

```js
const pendingNativeCalls = new Map();
let nativeCallId = 0;

function callNative(message) {
  const callId = String(++nativeCallId);
  window.webkit.messageHandlers.aiChat.postMessage({ ...message, callId });
  return new Promise((resolve, reject) => {
    pendingNativeCalls.set(callId, { resolve, reject });
  });
}

window.__resolveAiChatNativeCall = (callId, success, payload) => {
  const pending = pendingNativeCalls.get(callId);
  if (!pending) return;
  pendingNativeCalls.delete(callId);
  if (success) pending.resolve(payload);
  else pending.reject(payload);
};

window.CentAIChatHost = {
  getInit() {
    return callNative({
      type: "getInit",
    });
  },
  requestAI(args) {
    window.webkit.messageHandlers.aiChat.postMessage({
      type: "requestAI",
      requestId: args.requestId,
      configId: args.configId,
      history: args.history,
    });
    window.__aiChatCallbacks ??= {};
    window.__aiChatCallbacks[args.requestId] = args;
    return {
      cancel() {
        window.webkit.messageHandlers.aiChat.postMessage({
          type: "cancel",
          requestId: args.requestId,
        });
      },
    };
  },
  callTool(args) {
    return callNative({
      type: "callTool",
      ...args,
    });
  },
};
```

Swift should keep a dictionary keyed by `requestId`. For each provider chunk,
evaluate JavaScript that calls:

```js
window.__aiChatCallbacks[requestId].onChunk({ thought, answer });
window.__aiChatCallbacks[requestId].onDone();
window.__aiChatCallbacks[requestId].onError(errorMessage);
```

## Android WebView Example

Expose a JavaScript interface:

```kotlin
class AiChatBridge {
    @JavascriptInterface
    fun postMessage(json: String) {
        val message = JSONObject(json)
        when (message.getString("type")) {
            "requestAI" -> startRequest(message)
            "cancel" -> cancelRequest(message.getString("requestId"))
            "callTool" -> callTool(message)
            "loadSkill" -> loadSkill(message)
        }
    }
}

webView.addJavascriptInterface(AiChatBridge(), "AndroidAiChat")
```

Injected JavaScript can wrap `AndroidAiChat.postMessage(JSON.stringify(...))`
into the same `HostBridge` shape used by Web and iOS. Android should keep a
`requestId -> Job` map and cancel the corresponding job when ai-chat calls
`cancel()`.

## Persistence

`ai-chat.html` stores only:

- chat ids;
- message history;
- uploaded files referenced by chat messages;
- current selected chat id.

It does not store:

- API keys;
- API URLs;
- model names beyond the current runtime payload;
- system prompt;
- preset prompts;
- tool handlers;
- skill handlers.
