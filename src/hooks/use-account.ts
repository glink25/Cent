import type { Account } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useCallback } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";

export function useAccount() {
    const accounts = useLedgerStore(
        useShallow((state) => state.infos?.meta.accounts ?? []),
    );

    const add = useCallback(async (newAccount: Omit<Account, "id">) => {
        const { promise, resolve, reject } = Promise.withResolvers<string>();
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            reject("no book");
            return promise;
        }
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.accounts?.some((a) => a.name === newAccount.name)) {
                reject("account name already exist");
                return prev;
            }
            if (prev.accounts === undefined) {
                prev.accounts = [];
            }
            const id = v4();
            prev.accounts.push({ ...newAccount, id });
            resolve(id);
            return prev;
        });
        return promise;
    }, []);

    const update = useCallback(
        async (id: string, value?: Omit<Account, "id">) => {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (prev.accounts === undefined) {
                    return prev;
                }
                if (value === undefined) {
                    prev.accounts = prev.accounts.filter((v) => v.id !== id);
                    return prev;
                }
                const index = prev.accounts.findIndex((v) => v.id === id);
                if (index === -1) {
                    return prev;
                }
                prev.accounts[index] = { ...prev.accounts[index], ...value };
                return prev;
            });
        },
        [],
    );

    const setDefault = useCallback(async (id: string) => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.accounts === undefined) {
                return prev;
            }
            prev.accounts.forEach((account) => {
                account.isDefault = account.id === id;
            });
            return prev;
        });
    }, []);

    return {
        accounts,
        add,
        update,
        setDefault,
    };
}