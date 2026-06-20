import type {
    AbortablePromise,
    AssistantMessage,
    History,
    UserMessage,
    ZodLikeSchema,
} from "./type";

export function createAbortError() {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}

export function withAbort<T>(
    promise: Promise<T>,
    abort: () => void,
): AbortablePromise<T> {
    return Object.assign(promise, { abort });
}

export function cloneValue<T>(value: T): T {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneHistory(history: History): History {
    return history.map((message) => cloneValue(message));
}

export function createAssistantMessage(): AssistantMessage {
    return {
        role: "assistant",
        raw: "",
        formatted: {},
    };
}

export function createUserMessage(
    message: string,
    assets?: File[],
): UserMessage {
    return {
        role: "user",
        raw: message,
        assets,
    };
}

export function parseWithSchema<T>(
    schema: ZodLikeSchema | undefined,
    value: unknown,
): T {
    if (!schema) {
        return value as T;
    }
    const result = schema.safeParse(value);
    if (!result.success) {
        throw result.error;
    }
    return result.data as T;
}

export function stringifyJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return JSON.stringify(String(value));
    }
}
