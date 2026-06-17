import { googleAIStudioAdapter } from "./google";
import { openAICompatibleAdapter } from "./openai";
import type { ProviderAdapter } from "./types";

const adapters = new Map<string, ProviderAdapter>();

export function registerAdapter(adapter: ProviderAdapter) {
    adapters.set(adapter.apiType, adapter);
}

export function getAdapter(apiType: string): ProviderAdapter {
    const adapter = adapters.get(apiType);
    if (!adapter) {
        throw new Error(`Unsupported AI apiType: ${apiType}`);
    }
    return adapter;
}

registerAdapter(openAICompatibleAdapter);
registerAdapter(googleAIStudioAdapter);

export type { ChatMessage, ProviderAdapter } from "./types";
