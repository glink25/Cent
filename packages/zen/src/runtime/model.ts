import type { ZenDirectorMode } from "./types";

export function resolveZenDirectorConfig({
    configs,
    aiConfigId,
    defaultConfigId,
}: {
    configs: Array<{ id: string }>;
    aiConfigId?: string | null;
    defaultConfigId?: string;
}): { directorMode: ZenDirectorMode; configId?: string } {
    if (aiConfigId === null) return { directorMode: "local" };
    const explicitId = configs.some((config) => config.id === aiConfigId)
        ? (aiConfigId ?? undefined)
        : undefined;
    const validDefaultId = configs.some(
        (config) => config.id === defaultConfigId,
    )
        ? defaultConfigId
        : undefined;
    const configId = explicitId ?? validDefaultId;
    return configId
        ? { directorMode: "ai", configId }
        : { directorMode: "local" };
}
