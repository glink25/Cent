import { produce } from "immer";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { StorageAPI } from "../api/storage";

type Book = { id: string; repo: any };
type BookStoreState = {
	currentBookId: string | undefined;
	books: Book[];
	visible: boolean;
	loading: boolean;
};

type BookStoreActions = {
	addBook: (name: string) => Promise<void>;
	deleteBook: (id: string) => Promise<void>;
	switchToBook: (id: string) => Promise<void>;
	updateBookList: () => Promise<Book[]>;
};

type BookStore = BookStoreState & BookStoreActions;

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

export const useBookStore = create<BookStore>()(
	(persist as Persist<BookStore>)(
		(set) => {
			const visible = false;
			const loading = false;
			const updateBookList = async () => {
				await Promise.resolve();
				set(
					produce((state) => {
						state.loading = true;
					}),
				);
				try {
					const res = await StorageAPI.fetchAllStore();
					const allBooks = res.map((repo) => {
						return {
							repo,
							id: repo,
						};
					});
					set(
						produce((state: BookStore) => {
							state.books = allBooks;
						}),
					);
					return allBooks;
				} finally {
					set(
						produce((state) => {
							state.loading = false;
						}),
					);
				}
			};
			updateBookList();
			return {
				loading,
				visible,
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
							state.visible = false;
							Promise.resolve().then(() => {
								location.reload()
							})
						}),
					);
				},
			};
		},
		{
			name: "book-store",
			storage: createJSONStorage(() => localStorage),
			version: 0,
			partialize(state) {
				return {
					books: state.books,
					currentBookId: state.currentBookId
				} as any
			},
		},
	),
);
