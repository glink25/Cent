import { produce } from "immer";
import { merge } from "lodash-es";
import { v4 } from "uuid";
import { create } from "zustand";
import type { OutputType } from "@/gitray";
import type { Action, MetaUpdate, Update } from "@/gitray/stash";
import type { Bill, BillCategory } from "@/ledger/type";
import {
	type GlobalMeta,
	StorageAPI,
	StorageDeferredAPI,
} from "../api/storage";
import { useBookStore } from "./book";
import { useUserStore } from "./user";
import { toast } from "sonner";
import { t } from "@/locale";
import { UserAPI, type UserInfo } from "@/api/user";

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

	refreshBillList: () => Promise<void>;

	updateGlobalMeta: (
		v: Partial<GlobalMeta> | ((prev: GlobalMeta) => GlobalMeta),
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

		const [bills, deferredInfo, creators] = await Promise.all([
			StorageAPI.getAllItems(repo),
			StorageDeferredAPI.getInfo(repo),
			UserAPI.getCollaborators(repo),
		]);

		set(
			produce((state: LedgerStore) => {
				state.bills = bills;
				state.infos = { ...deferredInfo, creators };
			}),
		);
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
					t("Repo not found, maybe it was deleted, please select another book"),
					{
						position: "top-center",
						action: {
							label: t("Go"),
							onClick: () => {
								useBookStore.setState((prev) => ({ ...prev, visible: true }));
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
		try {
			await finished;
			set(
				produce((state: LedgerStoreState) => {
					state.sync = "success";
				}),
			);
		} catch (error) {
			console.error(error);
			set(
				produce((state: LedgerStoreState) => {
					state.sync = "failed";
				}),
			);
		}
	});

	return {
		loading: false,
		sync: "success",
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
					value: { ...v, creatorId, id: v4() },
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
					value: { id, ...v, creatorId },
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
		batchImport: async (
			data: Omit<Bill, "id" | "creatorId">[],
			overlap = false,
		) => {
			if (data.length === 0) {
				return;
			}
			const repo = getCurrentFullRepoName();
			const creatorId = useUserStore.getState().id;
			const actions = data.map((v) => {
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
