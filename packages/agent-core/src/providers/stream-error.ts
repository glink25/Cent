/** Some gateways report request failures as an SSE frame after HTTP 200. */
export class ProviderStreamError extends Error {
    readonly status?: number;
    constructor(value: unknown) {
        const payload = value as {
            message?: unknown;
            status?: unknown;
            code?: unknown;
        } | null;
        super(
            typeof payload?.message === "string"
                ? payload.message
                : typeof value === "string"
                  ? value
                  : "Model stream reported an error",
        );
        const status = Number(payload?.status ?? payload?.code);
        if (status >= 400 && status <= 599) this.status = status;
    }
}
