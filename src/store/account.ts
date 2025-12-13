import type { Account } from "@/ledger/type";
import { create } from "zustand";
import { useLedgerStore } from "./ledger";

type AccountStoreState = {
    accounts: Account[];
    loading: boolean;
};

type AccountStoreActions = {
    addAccount: (account: Omit<Account, "id">) => Promise<void>;
    updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
    removeAccount: (id: string) => Promise<void>;
    setDefaultAccount: (id: string) => Promise<void>;
    refreshAccounts: () => Promise<void>;
};

type AccountStore = AccountStoreState & AccountStoreActions;

export const useAccountStore = create<AccountStore>((set, get) => ({
    accounts: [],
    loading: false,

    addAccount: async (accountData) => {
        const ledgerStore = useLedgerStore.getState();
        if (!ledgerStore.infos?.meta) return;

        const newAccount: Account = {
            id: crypto.randomUUID(),
            ...accountData,
        };

        await ledgerStore.updateGlobalMeta((prev) => ({
            ...prev,
            accounts: [...(prev.accounts || []), newAccount],
        }));

        await get().refreshAccounts();
    },

    updateAccount: async (id, accountData) => {
        const ledgerStore = useLedgerStore.getState();
        if (!ledgerStore.infos?.meta) return;

        await ledgerStore.updateGlobalMeta((prev) => ({
            ...prev,
            accounts: (prev.accounts || []).map(acc =>
                acc.id === id ? { ...acc, ...accountData } : acc
            ),
        }));

        await get().refreshAccounts();
    },

    removeAccount: async (id) => {
        const ledgerStore = useLedgerStore.getState();
        if (!ledgerStore.infos?.meta) return;

        await ledgerStore.updateGlobalMeta((prev) => ({
            ...prev,
            accounts: (prev.accounts || []).filter(acc => acc.id !== id),
        }));

        await get().refreshAccounts();
    },

    setDefaultAccount: async (id) => {
        const ledgerStore = useLedgerStore.getState();
        if (!ledgerStore.infos?.meta) return;

        await ledgerStore.updateGlobalMeta((prev) => ({
            ...prev,
            accounts: (prev.accounts || []).map(acc => ({
                ...acc,
                isDefault: acc.id === id,
            })),
        }));

        await get().refreshAccounts();
    },

    refreshAccounts: async () => {
        const ledgerStore = useLedgerStore.getState();
        set({
            accounts: ledgerStore.infos?.meta?.accounts || [],
            loading: false,
        });
    },
}));