import { produce } from "immer";
import { merge } from "lodash-es";
import { toast } from "sonner";
import { v4 } from "uuid";
import { create } from "zustand";
import { UserAPI, type UserInfo } from "@/api/user";
import type { OutputType } from "@/gitray";
import type { Action, Full, Update } from "@/gitray/stash";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";
import {
    type GlobalMeta,
    type PersonalMeta,
    StorageAPI,
    StorageDeferredAPI,
} from "../api/storage";
import { useBookStore } from "./book";
import { useUserStore } from "./user";

export type EditBill = Omit<OutputType<Bill>, "id"> & {
    id?: Bill["id"];
    creatorId?: Bill["creatorId"];
};

type LedgerStoreState = {
    bills: OutputType<Bill>[];
    actions: Action<Bill>[];
    infos?: {
        meta: GlobalMeta;
        creators?: UserInfo[];
    };

    loading: boolean;
    sync: /** 等待同步 */
        | "wait"
        /** 正在同步*/
        | "syncing"
        /** 同步成功*/
        | "success"
        /** 同步失败*/
        | "failed";
};

type LedgerStoreActions = {
    addBill: (entry: Omit<Bill, "id" | "creatorId">) => Promise<void>;
    removeBill: (id: Bill["id"]) => Promise<void>;
    updateBill: (
        id: Bill["id"],
        entry: Omit<Bill, "id" | "creatorId">,
    ) => Promise<void>;
    batchImport: (
        entries: Omit<Bill, "id" | "creatorId">[],
        overlap?: boolean,
    ) => Promise<void>;

    refreshBillList: () => Promise<Full<Bill>[]>;

    updateGlobalMeta: (
        v: Partial<GlobalMeta> | ((prev: GlobalMeta) => GlobalMeta),
    ) => Promise<void>;
    updatePersonalMeta: (
        v: Partial<PersonalMeta> | ((prev: PersonalMeta) => PersonalMeta),
    ) => Promise<void>;
};

type LedgerStore = LedgerStoreState & LedgerStoreActions;

export const useLedgerStore = create<LedgerStore>()((set, get) => {
    const getCurrentFullRepoName = () => {
        const id = useBookStore.getState().currentBookId;
        if (id === undefined) {
            throw new Error("currentBookId not found");
        }
        return id;
    };
    const updateBillList = async () => {
        await Promise.resolve();
        const repo = getCurrentFullRepoName();
        const [bills] = await Promise.all([
            StorageAPI.getAllItems(repo).then((bills) => {
                set(
                    produce((state: LedgerStore) => {
                        state.bills = bills;
                        // state.infos = { ...deferredInfo, creators };
                    }),
                );
                return bills;
            }),
            StorageDeferredAPI.getInfo(repo).then((deferredInfo) => {
                set(
                    produce((state: LedgerStore) => {
                        state.infos = { ...state.infos, ...deferredInfo };
                    }),
                );
            }),
        ]);
        useUserStore
            .getState()
            .getCollaborators(repo)
            .then((creators) => {
                set(
                    produce((state: LedgerStore) => {
                        const uid = useUserStore.getState().login;
                        const personalMeta = state.infos?.meta.personal?.[uid];
                        const names = personalMeta?.names;
                        state.infos = {
                            ...state.infos!,
                            creators: (creators ?? []).map((c) => ({
                                ...c,
                                originalName: c.name,
                                name: names?.[c.login] ?? c.name,
                            })),
                        };
                    }),
                );
            })
            .catch((err) => []);
        return bills;
    };

    const init = async () => {
        await Promise.resolve();
        set(
            produce((state: LedgerStoreState) => {
                state.loading = true;
            }),
        );
        try {
            updateBillList();
            StorageAPI.toSync();
            const currentBookId = useBookStore.getState().currentBookId;
            if (!currentBookId) {
                return;
            }
            await StorageAPI.initStore(currentBookId);
            await updateBillList();
        } catch (err) {
            if ((err as any)?.status === 404) {
                toast.error(
                    t(
                        "Repo not found, maybe it was deleted, please select another book",
                    ),
                    {
                        position: "top-center",
                        action: {
                            label: t("Go"),
                            onClick: () => {
                                useBookStore.setState((prev) => ({
                                    ...prev,
                                    visible: true,
                                }));
                            },
                        },
                    },
                );
            }
        } finally {
            set(
                produce((state: LedgerStoreState) => {
                    state.loading = false;
                }),
            );
        }
    };
    init();

    // subscribe changes
    useBookStore.subscribe(async (state, prev) => {
        const { currentBookId } = state;
        if (!currentBookId) {
            return;
        }
        if (currentBookId === prev.currentBookId) {
            return;
        }
        set(
            produce((state: LedgerStoreState) => {
                state.loading = true;
            }),
        );
        try {
            await StorageAPI.initStore(currentBookId);
            await updateBillList();
        } finally {
            set(
                produce((state: LedgerStoreState) => {
                    state.loading = false;
                }),
            );
        }
    });

    StorageAPI.onChange(() => {
        updateBillList();

        StorageAPI.getIsNeedSync().then((needSync) => {
            if (needSync) {
                set(
                    produce((state: LedgerStoreState) => {
                        state.sync = "wait";
                    }),
                );
            }
        });
    });

    StorageAPI.onSync(async (finished) => {
        set(
            produce((state: LedgerStoreState) => {
                state.sync = "syncing";
            }),
        );
        console.log("start sync");
        try {
            await finished;
            set(
                produce((state: LedgerStoreState) => {
                    state.sync = "success";
                }),
            );
            console.log("sync success");
        } catch (error) {
            console.error("sync error", error);
            set(
                produce((state: LedgerStoreState) => {
                    state.sync = "failed";
                }),
            );
        }
    });

    return {
        loading: false,
        sync: "success" as LedgerStore["sync"],
        bills: [],
        actions: [],
        pendingCursor: undefined,
        refreshBillList: updateBillList,
        removeBill: async (id) => {
            const repo = getCurrentFullRepoName();
            const collection = `${useUserStore.getState().id}`;
            StorageAPI.batch(repo, [
                {
                    type: "delete",
                    value: id,
                },
            ]);
        },
        addBill: async (v) => {
            const repo = getCurrentFullRepoName();
            const creatorId = useUserStore.getState().id;
            StorageAPI.batch(repo, [
                {
                    type: "update",
                    value: {
                        ...v,
                        amount: Math.abs(v.amount),
                        creatorId,
                        id: v4(),
                    },
                },
            ]);
        },
        updateBill: async (id, v) => {
            const repo = getCurrentFullRepoName();
            const collection = `${useUserStore.getState().id}`;
            const creatorId = useUserStore.getState().id;
            StorageAPI.batch(repo, [
                {
                    type: "update",
                    value: { id, ...v, amount: Math.abs(v.amount), creatorId },
                },
            ]);
        },
        updateGlobalMeta: async (v) => {
            const repo = getCurrentFullRepoName();
            const prevMeta = await StorageAPI.getMeta(repo);
            const newMeta =
                typeof v === "function" ? v(prevMeta) : merge(prevMeta, v);
            await StorageAPI.batch(repo, [
                {
                    type: "meta",
                    metaValue: newMeta,
                },
            ]);
            await updateBillList();
        },
        updatePersonalMeta: async (v) => {
            const repo = getCurrentFullRepoName();
            const prevMeta = await StorageAPI.getMeta(repo);
            const uid = useUserStore.getState().login;
            const personalMeta =
                (prevMeta as GlobalMeta | undefined)?.personal?.[uid] ?? {};
            const newPersonalMeta =
                typeof v === "function"
                    ? v(personalMeta)
                    : merge(personalMeta, v);
            const newMeta = merge(prevMeta, {
                personal: { [uid]: newPersonalMeta },
            });
            await StorageAPI.batch(repo, [
                {
                    type: "meta",
                    metaValue: newMeta,
                },
            ]);
            await updateBillList();
        },
        batchImport: async (
            data: Omit<Bill, "id" | "creatorId">[],
            overlap = false,
        ) => {
            if (data.length === 0) {
                throw new Error("没有可导入的项目");
            }
            // check if repeated
            const allItems = await updateBillList();

            const { repeated, valid } = data.reduce(
                (p, c) => {
                    if (allItems.some((b) => b.time === c.time)) {
                        p.repeated.push(c);
                    } else {
                        p.valid.push(c);
                    }
                    return p;
                },
                {
                    repeated: [] as typeof data,
                    valid: [] as typeof data,
                },
            );
            if (repeated.length > 0) {
                const ok = confirm(
                    `包含${repeated.length}条重复项目，是否去除后继续导入？`,
                );
                if (!ok) {
                    throw new Error("导入取消");
                }
            }
            const repo = getCurrentFullRepoName();
            const creatorId = useUserStore.getState().id;
            const actions = valid.map((v) => {
                return {
                    type: "update",
                    value: { ...v, creatorId, id: v4() },
                } as Update<Bill>;
            });
            StorageAPI.batch(repo, actions);
            // if (overlap) {
            // 	const current = get().bills.filter((v) => v.creatorId === creatorId);
            // 	actions.push(
            // 		...current.map(
            // 			(v) =>
            // 				({
            // 					type: "remove",
            // 					store: repo,
            // 					params: v.id,
            // 					collection: `${creatorId}`,
            // 				}) as BaseItemAction<Bill>,
            // 		),
            // 	);
            // }
        },
    };
});
