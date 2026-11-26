import type { AuthorizeTool, ToolAuthorizationRequest } from "./type";

export async function finishToolAuthorization<T>(
    request: ToolAuthorizationRequest,
    decide: (
        id: string,
        approved: boolean,
        remember: boolean,
        signal?: AbortSignal,
    ) => Promise<T>,
    authorize: AuthorizeTool,
    signal?: AbortSignal,
): Promise<T> {
    let decision: Awaited<ReturnType<AuthorizeTool>>;
    try {
        signal?.throwIfAborted();
        decision = await authorize(request, signal);
    } catch (error) {
        await decide(request.id, false, false).catch(() => undefined);
        throw error;
    }
    if (decision.approved !== true || signal?.aborted) {
        await decide(request.id, false, false).catch(() => undefined);
        signal?.throwIfAborted();
        throw new Error("Tool authorization was denied");
    }
    return decide(
        request.id,
        true,
        request.canRemember && decision.remember === true,
        signal,
    );
}
