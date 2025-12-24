import { produce } from "immer";
import { merge } from "lodash-es";
import { v4 } from "uuid";
import { create } from "zustand";
import type { UserInfo } from "@/api/endpoints/type";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { Action, Full, OutputType, Update } from "@/database/stash";
import type { Bill, GlobalMeta, PersonalMeta } from "@/ledger/type";
import { t } from "@/locale";
import { useBookStore } from "./book";
import { useUserStore } from "./user";

const toastLib = import("sonner");

export type EditBill = Omit<OutputType<Bill>, "id"> & {
    id?: Bill["id"];
    creatorId?: Bill["creatorId"];
};

type LedgerStoreState = {
    /** 首次加载时只有前200条数据，如果需要全部数据，必须调用 ledgerStore.refreshBillList() */
    bills: OutputType<Bill>[];
    actions: Action<Bill>[];
    infos?: {
        meta: GlobalMeta;
        creators?: (UserInfo & { originalName: string })[];
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
    removeBills: (ids: Bill["id"][]) => Promise<void>;
    removeBill: (id: Bill["id"]) => Promise<void>;
    updateBill: (
        id: Bill["id"],
        entry: Omit<Bill, "id" | "creatorId">,
    ) => Promise<void>;
    updateBills: (
        entires: { id: Bill["id"]; entry: Omit<Bill, "id" | "creatorId"> }[],
    ) => Promise<void>;
    batchImportFromBills: (
        entries: Omit<Bill, "id" | "creatorId">[],
        overlap?: boolean,
    ) => Promise<void>;

    refreshBillList: () => Promise<Full<Bill>[]>;
    initCurrentBook: () => Promise<void>;

    updateGlobalMeta: (
        v: Partial<GlobalMeta> | ((prev: GlobalMeta) => GlobalMeta),
    ) => Promise<void>;
    updatePersonalMeta: (
        v: Partial<PersonalMeta> | ((prev: PersonalMeta) => PersonalMeta),
    ) => Promise<void>;
};

type LedgerStore = LedgerStoreState & LedgerStoreActions;

const MIN_SIZE = 200;

export const useLedgerStore = create<LedgerStore>()((set, get) => {
    const getCurrentFullRepoName = () => {
        const id = useBookStore.getState().currentBookId;
        if (id === undefined) {
            throw new Error("currentBookId not found");
        }
        return id;
    };

    const updateBillList = async (limit?: number) => {
        const { StorageAPI, StorageDeferredAPI } = await loadStorageAPI();
        const repo = getCurrentFullRepoName();
        const [bills] = await Promise.all([
            // 贪婪更新账单数据
            (limit && limit >= get().bills.length
                ? StorageDeferredAPI.truncate(repo, limit)
                : StorageDeferredAPI.filter(repo, {})
            ).then((bills) => {
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
                        const uid = useUserStore.getState().id;
                        const personalMeta = state.infos?.meta.personal?.[uid];
                        const names = personalMeta?.names;
                        state.infos = {
                            ...state.infos!,
                            creators: (creators ?? []).map((c) => ({
                                ...c,
                                originalName: c.name,
                                name: names?.[c.id] ?? c.name,
                            })),
                        };
                    }),
                );
            })
            .catch((err) => []);
        return bills;
    };

    const init = async () => {
        const { StorageAPI } = await loadStorageAPI();
        await Promise.resolve();
        set(
            produce((state: LedgerStoreState) => {
                state.loading = true;
            }),
        );
        try {
            const currentBookId = useBookStore.getState().currentBookId;
            if (!currentBookId) {
                return;
            }
            await updateBillList(MIN_SIZE);
            await StorageAPI.initBook(currentBookId);
            // 初始化时先加载100条，后续按需加载全部
            await updateBillList(MIN_SIZE);
            StorageAPI.toSync();
        } catch (err) {
            if ((err as any)?.status === 404) {
                const { toast } = await toastLib;
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

    // no more needed because location.reload subscribe changes
    // useBookStore.subscribe(async (state, prev) => {
    //     const { currentBookId } = state;
    //     if (!currentBookId) {
    //         return;
    //     }
    //     if (currentBookId === prev.currentBookId) {
    //         return;
    //     }
    //     set(
    //         produce((state: LedgerStoreState) => {
    //             state.loading = true;
    //         }),
    //     );
    //     try {
    //         const { StorageAPI } = await loadStorageAPI();
    //         await StorageAPI.initBook(currentBookId);
    //         await init();
    //     } finally {
    //         set(
    //             produce((state: LedgerStoreState) => {
    //                 state.loading = false;
    //             }),
    //         );
    //     }
    // });

    loadStorageAPI().then(({ StorageAPI }) => {
        StorageAPI.onChange(() => {
            updateBillList(MIN_SIZE);
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
    });

    const removeBills: LedgerStoreActions["removeBills"] = async (ids) => {
        const { StorageAPI } = await loadStorageAPI();
        const repo = getCurrentFullRepoName();
        const collection = `${useUserStore.getState().id}`;
        await StorageAPI.batch(
            repo,
            ids.map((id) => ({
                type: "delete",
                value: id,
            })),
        );
    };
    const updateBills: LedgerStoreActions["updateBills"] = async (entries) => {
        const { StorageAPI } = await loadStorageAPI();
        const repo = getCurrentFullRepoName();
        const collection = `${useUserStore.getState().id}`;
        const creatorId = useUserStore.getState().id;
        await StorageAPI.batch(
            repo,
            entries.map(({ id, entry: v }) => {
                return {
                    type: "update",
                    value: {
                        id,
                        ...v,
                        amount: Math.abs(v.amount),
                        creatorId,
                    },
                };
            }),
        );
    };

    return {
        loading: false,
        sync: "success" as LedgerStore["sync"],
        bills: [],
        actions: [],
        pendingCursor: undefined,
        initCurrentBook: init,
        refreshBillList: updateBillList,
        removeBills,
        removeBill: async (id) => {
            return removeBills([id]);
        },
        addBill: async (v) => {
            const { StorageAPI } = await loadStorageAPI();
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
        updateBills,
        updateBill: async (id, entry) => {
            return updateBills([{ id, entry }]);
        },
        updateGlobalMeta: async (v) => {
            const { StorageAPI } = await loadStorageAPI();
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
        },
        updatePersonalMeta: async (v) => {
            const { StorageAPI } = await loadStorageAPI();
            const repo = getCurrentFullRepoName();
            const prevMeta = await StorageAPI.getMeta(repo);
            const uid = useUserStore.getState().id;
            const personalMeta: PersonalMeta =
                (prevMeta as GlobalMeta | undefined)?.personal?.[uid] ?? {};
            const newPersonalMeta =
                typeof v === "function"
                    ? v(personalMeta)
                    : { ...personalMeta, ...v };
            const newMeta = {
                ...prevMeta,
                personal: {
                    ...prevMeta.personal,
                    [uid]: newPersonalMeta,
                },
            };
            await StorageAPI.batch(repo, [
                {
                    type: "meta",
                    metaValue: newMeta,
                },
            ]);
        },

        batchImportFromBills: async (
            data: Omit<Bill, "id" | "creatorId">[],
            overlap = false,
        ) => {
            const { StorageAPI } = await loadStorageAPI();
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
