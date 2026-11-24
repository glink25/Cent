import { afterEach, expect, it, vi } from "vitest";
import { getAndroidNativeHost } from "./native-host";
import type { NativeBridgeMessage } from "./types";

afterEach(() => vi.unstubAllGlobals());

it("negotiates clipboard support and forwards text verbatim", async () => {
    let clipboardSupport = false;
    const postMessage = vi.fn((json: string) => {
        const message: NativeBridgeMessage = JSON.parse(json);
        const callback = window.__AIChatNativeCallbacks?.[message.id];
        if (message.type === "getInit") {
            callback?.resolve?.({ bridgeVersion: 4, clipboardSupport });
        }
        if (message.type === "copyText") {
            if (message.payload.text === "reject")
                callback?.reject?.({ message: "Clipboard is unavailable" });
            else callback?.resolve?.(undefined);
        }
    });
    vi.stubGlobal("window", { CentAiChatNative: { postMessage } });
    const host = getAndroidNativeHost();
    expect(host).toBeDefined();
    await host?.getInit?.();
    expect(host?.copyText).toBeUndefined();

    clipboardSupport = true;
    await host?.getInit?.();
    const text = "中文\n  <code> & \"quote\"\n";
    expect(host?.copyText).toBeTypeOf("function");
    await host?.copyText?.(text);
    expect(JSON.parse(postMessage.mock.lastCall?.[0] ?? "")).toMatchObject({
        type: "copyText",
        payload: { text },
    });
    await expect(host?.copyText?.("reject")).rejects.toThrow(
        "Clipboard is unavailable",
    );
    expect(window.__AIChatNativeCallbacks).toEqual({});
});
