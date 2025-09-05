import { produce } from "immer";
import { v4 } from "uuid";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { StorageAPI } from "../api/storage";
import { useBookStore } from "./book";

type Entry = { id: string; amount: number; comment?: string };

type LedgerStoreState = {
	entries: Entry[];
};

type LedgerStoreActions = {
	addEntry: (entry: Omit<Entry, "id">) => Promise<void>;
	deleteEntry: (id: Entry["id"]) => Promise<void>;
	updateEntryList: () => Promise<void>;
};

type BookStore = LedgerStoreState & LedgerStoreActions;

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

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
					state.entries = res as any[];
				}),
			);
		};
		updateEntryList();
		return {
			entries: [],
			updateEntryList,
			deleteEntry: async (id) => {
				const repo = getCurrentFullRepoName();
				await StorageAPI.removeItem(repo, id);
				await updateEntryList();
			},
			addEntry: async (v) => {
				const repo = getCurrentFullRepoName();
				await StorageAPI.addItem(repo, { ...v, id: v4() });
				await updateEntryList();
			},
		};
	},
	// 	{
	// 		name: "book-store",
	// 		storage: createJSONStorage(() => localStorage),
	// 		version: 0,
	// 	},
	// ),
);
