import { produce } from "immer";
import { v4 } from "uuid";
import { create, type StateCreator } from "zustand";
import {
	createJSONStorage,
	type PersistOptions,
	persist,
} from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { createComputed } from "zustand-computed";
import type { BatchOperations, OutputType } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { StorageAPI } from "../api/storage";
import { useBookStore } from "./book";
import { useUserStore } from "./user";

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

type Computed<S> = (config: StateCreator<S>) => StateCreator<S>;

export type EditBill = Omit<OutputType<Bill>, "id"> & { id?: Bill["id"] };

type BatchOperation = Required<BatchOperations<Bill>>;
type Action =
	| {
			type: "add";
			repo: string;
			params: BatchOperation["adds"][number];
	  }
	| {
			type: "remove";
			repo: string;
			params: BatchOperation["removes"][number];
	  }
	| {
			type: "update";
			repo: string;
			params: BatchOperation["updates"][number];
	  };

type LedgerStoreState = {
	_bills: OutputType<Bill>[];

	actions: Action[];
};

type LedgerStoreActions = {
	addBill: (entry: Omit<Bill, "id">) => Promise<void>;
	removeBill: (id: Bill["id"]) => Promise<void>;
	updateBill: (id: Bill["id"], entry: Omit<Bill, "id">) => Promise<void>;

	refreshBillList: () => Promise<void>;
};

type LedgerStore = LedgerStoreState & LedgerStoreActions;

type ComputedState = {
	allBills: LedgerStoreState["_bills"];
};

const computed = createComputed(
	(state: LedgerStore): ComputedState => ({
		allBills: (() => {
			const actions = state.actions;
			if (actions.length === 0) {
				return state._bills;
			}
			const valid = new Set(actions.map((a) => a.repo)).size === 1;
			if (!valid) {
				throw new Error("local actions has different repoName");
			}
			const bills = [...state._bills];
			actions.forEach((ac) => {
				if (ac.type === "add") {
					bills.push({
						...ac.params,
						creatorId: "",
					} as any);
				} else if (ac.type === "remove") {
					const index = bills.findIndex((b) => b.id === ac.params);
					bills.splice(index, 1);
				} else if (ac.type === "update") {
					const index = bills.findIndex((b) => b.id === ac.params.id);
					bills[index] = { ...bills[index], ...ac.params.changes } as any;
				}
			});
			return bills;
		})(),
	}),
);

export const useLedgerStore = create<LedgerStore>()(
	(persist as Persist<LedgerStore>)(
		(computed as Computed<LedgerStore>)((set, get) => {
			const getCurrentFullRepoName = () => {
				const id = useBookStore.getState().currentBookId;
				if (id === undefined) {
					throw new Error("currentBookId not found");
				}
				return id;
			};
			const updateEntryList = async () => {
				const repo = getCurrentFullRepoName();
				const res = await StorageAPI.getAllItems(repo);
				set(
					produce((state: LedgerStore) => {
						state._bills = res;
					}),
				);
			};
			updateEntryList();

			const scheduleBatch = async () => {
				const actions = get().actions;
				const cursor = actions.length;
				if (cursor === 0) {
					return;
				}
				const valid = new Set(actions.map((a) => a.repo)).size === 1;
				if (!valid) {
					throw new Error("local actions has different repoName");
				}
				const repo = actions[0].repo;
				const batch = actions.reduce(
					(p, c) => {
						if (c.type === "add") {
							p.adds.push(c.params);
						} else if (c.type === "remove") {
							p.removes.push(c.params);
						} else if (c.type === "update") {
							p.updates.push(c.params);
						}
						return p;
					},
					{
						adds: [],
						removes: [],
						updates: [],
					} as BatchOperation,
				);
				console.log(batch, "batchs");
				await StorageAPI.batch(repo, batch);
				set(
					produce((state: LedgerStore) => {
						state.actions = state.actions.slice(cursor);
					}),
				);
				updateEntryList();
			};

			let scheduleTimer: any;
			const readyToSchedule = () => {
				clearTimeout(scheduleTimer);
				scheduleTimer = setTimeout(() => {
					scheduleBatch();
				}, 2000);
			};
			return {
				_bills: [],
				actions: [],
				pendingCursor: undefined,
				refreshBillList: updateEntryList,
				removeBill: async (id) => {
					const repo = getCurrentFullRepoName();
					set(
						produce((state: LedgerStore) => {
							state.actions.push({ type: "remove", repo, params: id });
						}),
					);
					readyToSchedule();
				},
				addBill: async (v) => {
					const repo = getCurrentFullRepoName();
					const creatorId = useUserStore.getState().id;
					set(
						produce((state: LedgerStore) => {
							state.actions.push({
								type: "add",
								repo,
								params: { ...v, creatorId, id: v4() },
							});
						}),
					);
					readyToSchedule();
				},
				updateBill: async (id, v) => {
					const repo = getCurrentFullRepoName();
					set(
						produce((state: LedgerStore) => {
							state.actions.push({
								type: "update",
								repo,
								params: { id, changes: { ...v } },
							});
						}),
					);
					readyToSchedule();
				},
			};
		}),
		{
			name: "ledger-store",
			storage: createJSONStorage(() => localStorage),
			version: 0,
			partialize(state) {
				return {
					actions: state.actions,
				} as any;
			},
		},
	),
);

export const useBills = () => {
	const bills = (useLedgerStore() as any).allBills as ComputedState["allBills"];
	return bills;
};
