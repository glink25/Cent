import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AgentApiState = {
    enabled: boolean;
    token: string | null;
    port: number;
    setEnabled: (v: boolean) => void;
    setToken: (t: string | null) => void;
    setPort: (p: number) => void;
};

export const DEFAULT_AGENT_API_PORT = 47821;

export const useAgentApiStore = create<AgentApiState>()(
    persist(
        (set) => ({
            enabled: false,
            token: null,
            port: DEFAULT_AGENT_API_PORT,
            setEnabled: (enabled) => set({ enabled }),
            setToken: (token) => set({ token }),
            setPort: (port) => set({ port }),
        }),
        {
            name: "agent-api-store",
            storage: createJSONStorage(() => localStorage),
            version: 1,
            partialize: (s) => ({
                enabled: s.enabled,
                token: s.token,
                port: s.port,
            }),
        },
    ),
);

export function generateAgentApiToken(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => alphabet[b % alphabet.length]).join("");
}
