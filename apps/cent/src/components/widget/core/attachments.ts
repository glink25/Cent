import type { Bill } from "@/ledger/type";

const prefix = "widget-file:";

export function attachmentRef() {
    return prefix + crypto.randomUUID();
}

export function resolveAttachments(
    images: string[] | undefined,
    resolve: (ref: string) => File | undefined,
): Bill["images"] {
    return images?.map((ref) => {
        if (!ref.startsWith(prefix)) return ref;
        const file = resolve(ref);
        if (!file)
            throw new Error("The selected attachment is no longer available");
        return file;
    });
}
