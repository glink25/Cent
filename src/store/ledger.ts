import { produce } from "immer";
import { v4 } from "uuid";
import { create } from "zustand";
import type { OutputType } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { StorageAPI } from "../api/storage";
import { useBookStore } from "./book";

export type EditBill = Omit<OutputType<Bill>, "id"> & { id?: Bill["id"] };

type LedgerStoreState = {
	bills: OutputType<Bill & { creatorId: string }>[];
};

type LedgerStoreActions = {
	addBill: (entry: Omit<Bill, "id">) => Promise<void>;
	removeBill: (id: Bill["id"]) => Promise<void>;
	updateBill: (id: Bill["id"], entry: Omit<Bill, "id">) => Promise<void>;

	refreshBillList: () => Promise<void>;
};

type BookStore = LedgerStoreState & LedgerStoreActions;

export const useLedgerStore = create<BookStore>()(
	// (persist as Persist<BookStore>)(
	(set) => {
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
				produce((state: BookStore) => {
					state.bills = res.map((v) => {
						const creatorId = v._meta.filePath;
						return { ...v, creatorId };
					});
				}),
			);
		};
		updateEntryList();
		return {
			bills: [],
			refreshBillList: updateEntryList,
			removeBill: async (id) => {
				const repo = getCurrentFullRepoName();
				await StorageAPI.removeItem(repo, id);
				await updateEntryList();
			},
			addBill: async (v) => {
				const repo = getCurrentFullRepoName();
				await StorageAPI.addItem(repo, { ...v, id: v4() });
				await updateEntryList();
			},
			updateBill: async (id, v) => {
				const repo = getCurrentFullRepoName();
				await StorageAPI.updateItem(repo, id, { ...v });
				await updateEntryList();
			},
		};
	},
);
