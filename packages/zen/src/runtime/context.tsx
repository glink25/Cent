import type { Provider, Tool } from "@glink25/chaty";
import { createContext, useContext } from "react";
import type { ZenInitPayload, ZenRuntimeHost } from "./types";

export type ZenRuntime = {
    host: ZenRuntimeHost;
    init: ZenInitPayload;
    provider: Provider;
    aiTools: Tool[];
};

export const ZenRuntimeContext = createContext<ZenRuntime | undefined>(
    undefined,
);

export function useZenRuntime() {
    const value = useContext(ZenRuntimeContext);
    if (!value)
        throw new Error("Zen must be rendered inside its runtime provider");
    return value;
}
