const legacyStorageKey = "cent-agent-grants-v1";

function legacyGrants(): { key: string; scope: string }[] {
    const raw = localStorage.getItem(legacyStorageKey);
    try {
        const grants = JSON.parse(raw ?? "[]");
        return Array.isArray(grants)
            ? grants.filter(
                  (grant) =>
                      typeof grant?.key === "string" &&
                      typeof grant?.scope === "string",
              )
            : [];
    } catch {
        return [];
    }
}

function resetKey(scope: string) {
    return `cent-agent-grant-reset:${scope}`;
}

function grantPrefix(scope: string) {
    return `cent-agent-grant:${JSON.stringify(scope)}:`;
}

export function assistantAuthorizationGeneration(scope: string) {
    return localStorage.getItem(resetKey(scope)) ?? "0";
}

export function hasAssistantGrant(scope: string, key: string) {
    const generation = assistantAuthorizationGeneration(scope);
    return (
        localStorage.getItem(`${grantPrefix(scope)}${generation}:${key}`) ===
            "1" ||
        (generation === "0" &&
            legacyGrants().some(
                (grant) => grant.key === key && grant.scope === scope,
            ))
    );
}

export function rememberAssistantGrant(
    scope: string,
    key: string,
    generation: string,
) {
    if (assistantAuthorizationGeneration(scope) === generation) {
        localStorage.setItem(`${grantPrefix(scope)}${generation}:${key}`, "1");
    }
}

export function resetAssistantAuthorizations(scope: string) {
    const prefix = grantPrefix(scope);
    const keys = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
    );
    localStorage.setItem(resetKey(scope), crypto.randomUUID());
    for (const key of keys) {
        if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
    localStorage.setItem(
        legacyStorageKey,
        JSON.stringify(legacyGrants().filter((grant) => grant.scope !== scope)),
    );
}
