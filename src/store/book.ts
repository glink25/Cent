import { produce } from "immer";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { StorageAPI } from "../api/storage";

type BookStoreState = {
	currentBookId: string | undefined;
	books: { id: string; repo: any }[];
};

type BookStoreActions = {
	addBook: (name: string) => Promise<void>;
	deleteBook: (id: number) => Promise<void>;
	switchToBook: (id: number) => Promise<void>;
	updateBookList: () => Promise<void>;
};

type BookStore = BookStoreState & BookStoreActions;

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

export const useBookStore = create<BookStore>()(
	(persist as Persist<BookStore>)(
		(set) => {
			const updateBookList = async () => {
				const res = await StorageAPI.fetchAllStore();
				console.log(res, "ssss");
				set(
					produce((state: BookStore) => {
						state.books = res.map((repo) => {
							return {
								repo,
								id: repo,
							};
						});
						if (state.books.length > 0) {
							state.currentBookId = state.books[0].id;
							StorageAPI.initStore(state.currentBookId);
						}
					}),
				);
			};
			updateBookList();
			return {
				books: [],
				currentBookId: undefined,
				updateBookList,
				addBook: async (name) => {
					await StorageAPI.createStore(name);
					await updateBookList();
				},
				deleteBook: async (id) => {
					await updateBookList();
				},
				switchToBook: async (id) => {
					set(
						produce((state) => {
							state.currentBookId = id;
						}),
					);
				},
			};
		},
		{
			name: "book-store",
			storage: createJSONStorage(() => localStorage),
			version: 0,
		},
	),
);
