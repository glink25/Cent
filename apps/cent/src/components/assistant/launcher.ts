import type { ConversationReference } from "@glink25/chaty";
import { create } from "zustand";
import { StorageAPI } from "@/api/storage";
import type { Bill } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";

export const useAssistantLauncher = create<{
    open: boolean;
    references: ConversationReference[];
}>(() => ({ open: false, references: [] }));

export function assistantScope() {
    return JSON.stringify([
        StorageAPI.type,
        useBookStore.getState().currentBookId,
        useUserStore.getState().id,
    ]);
}

export function addBillsToAssistant(
    bills: Pick<Bill, "id" | "comment" | "amount" | "time" | "type">[],
) {
    const scope = assistantScope();
    useAssistantLauncher.setState((state) => ({
        open: true,
        references: [
            ...state.references,
            ...bills.map((bill) => ({
                type: "cent.bill",
                id: bill.id,
                hostScope: scope,
                label:
                    bill.comment?.slice(0, 60) ||
                    `${new Date(bill.time).toLocaleDateString()} · ${bill.type === "expense" ? "−" : "+"}${bill.amount / 10000}`,
            })),
        ],
    }));
}
