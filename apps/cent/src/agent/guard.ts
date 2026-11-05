import type { Tool } from "@/assistant";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";

const writes = new Map<string, Promise<unknown>>();
/** Bind code invocations to their first ledger/viewer and serialize writes on that ledger. */
export function guardOperation(tool: Tool): Tool {
    return {
        ...tool,
        handler: async (args, context) => {
            const current = {
                bookId: useBookStore.getState().currentBookId,
                viewerId: useUserStore.getState().id,
            };
            const key = "cent:bound-context";
            const bound =
                (context.resources?.get(key) as typeof current | undefined) ??
                current;
            context.resources?.set(key, bound);
            const check = () => {
                context.signal?.throwIfAborted();
                if (!bound.bookId) throw new Error("No active ledger");
                if (
                    useBookStore.getState().currentBookId !== bound.bookId ||
                    useUserStore.getState().id !== bound.viewerId
                )
                    throw new Error("Ledger context changed");
            };
            check();
            const invoke = async () => {
                check();
                return tool.handler(args, context);
            };
            if (tool.effect !== "write") return invoke();
            const bookId = bound.bookId!;
            const pending = (writes.get(bookId) ?? Promise.resolve())
                .catch(() => {})
                .then(invoke);
            writes.set(bookId, pending);
            try {
                return await pending;
            } finally {
                if (writes.get(bookId) === pending) writes.delete(bookId);
            }
        },
    };
}
