import { produce } from "immer";
import { v4 } from "uuid";
import { create } from "zustand";
import type { Action, OutputType } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { StorageAPI } from "../api/storage";
import { useBookStore } from "./book";
import { useUserStore } from "./user";

export type EditBill = Omit<OutputType<Bill>, "id"> & {
	id?: Bill["id"];
	creatorId?: Bill["categoryId"];
};

type LedgerStoreState = {
	_bills: OutputType<Bill>[];

	actions: Action<Bill>[];
};

type LedgerStoreActions = {
	addBill: (entry: Omit<Bill, "id">) => Promise<void>;
	removeBill: (id: Bill["id"]) => Promise<void>;
	updateBill: (
		id: Bill["id"],
		entry: Omit<Bill, "id" | "creatorId">,
	) => Promise<void>;

	refreshBillList: () => Promise<void>;
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
	const updateEntryList = async () => {
		const repo = getCurrentFullRepoName();
		const res = await StorageAPI.getAllItems(repo, true);
		set(
			produce((state: LedgerStore) => {
				state._bills = res;
			}),
		);
	};
	// subscribe changes
	useBookStore.subscribe((state) => {
		if (state.currentBookId === undefined) {
			return;
		}
		updateEntryList();
	});
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
});

export const useBills = () => {
	const bills = useLedgerStore()._bills;
	return bills;
};
