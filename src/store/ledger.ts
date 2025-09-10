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
import type { Action, OutputType } from "@/gitray";
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

type BatchOperation = Required<Action<Bill>>;

type LedgerStoreState = {
	_bills: OutputType<Bill>[];

	actions: Action<Bill>[];
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

export const useLedgerStore = create<LedgerStore>()(
	(persist as Persist<LedgerStore>)(
		(set, get) => {
			const getCurrentFullRepoName = () => {
				const id = useBookStore.getState().currentBookId;
				if (id === undefined) {
					throw new Error("currentBookId not found");
				}
				return id;
			};
			const updateEntryList = async () => {
				const repo = getCurrentFullRepoName();
				const res = await StorageAPI.getAllItems(repo, true);
				set(
					produce((state: LedgerStore) => {
						state._bills = res;
					}),
				);
			};
			updateEntryList();
			StorageAPI.onChange(() => {
				updateEntryList();
			});

			return {
				_bills: [],
				actions: [],
				pendingCursor: undefined,
				refreshBillList: updateEntryList,
				removeBill: async (id) => {
					const repo = getCurrentFullRepoName();
					const collection = `${useUserStore.getState().id}`;
					StorageAPI.batch([
						{
							type: "remove",
							store: repo,
							params: id,
							collection,
						},
					]);
				},
				addBill: async (v) => {
					const repo = getCurrentFullRepoName();
					const creatorId = useUserStore.getState().id;
					StorageAPI.batch([
						{
							type: "add",
							store: repo,
							collection: `${creatorId}`,
							params: { ...v, creatorId, id: v4() },
						},
					]);
				},
				updateBill: async (id, v) => {
					const repo = getCurrentFullRepoName();
					const collection = `${useUserStore.getState().id}`;

					StorageAPI.batch([
						{
							type: "update",
							store: repo,
							collection,
							params: { id, changes: { ...v } },
						},
					]);
				},
			};
		},
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
	const bills = useLedgerStore()._bills;
	return bills;
};
