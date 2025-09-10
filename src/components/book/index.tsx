import { useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import Loading from "../loading";

export default function Book() {
	const isLogin = useUserStore(
		useShallow((state) => Boolean(state.login) && state.id > 0),
	);
	const { books, visible, currentBookId, loading } = useBookStore();
	// const bookNum = books.length;

	const [creating, setCreating] = useState(false);
	if (!isLogin) {
		return null;
	}
	if (currentBookId !== undefined && !visible) {
		return null;
	}

	const toSwitchBook = (bookId: string) => {
		useBookStore.getState().switchToBook(bookId);
	};
	return createPortal(
		<div className="fixed top-0 right-0 z-[9999] w-screen h-screen overflow-hidden">
			<div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
			<div className="w-full h-full flex justify-center items-center">
				<div className="bg-[white] w-[350px] h-[350px] p-4 flex flex-col justify-center items-center rounded">
					{books.length > 0 ? (
						<div className="flex-1 flex flex-col w-full gap-2">
							<div className="flex gap-2">
								Select a book {loading && <Loading></Loading>}
							</div>
							<div className="flex flex-col gap-2">
								{books.map((book) => {
									return (
										<button
											key={book.id}
											type="button"
											className="w-full rounded border p-2 cursor-pointer flex items-center justify-between"
											onClick={() => toSwitchBook(book.id)}
										>
											{book.repo}
											<div className="w-4 h-4 rounded-full border"></div>
										</button>
									);
								})}
							</div>
						</div>
					) : loading ? (
						<Loading>Loading Books...</Loading>
					) : (
						<div className="flex-1">No books, go create one</div>
					)}
					<button
						type="button"
						disabled={creating}
						className={cn(
							"rounded bg-black text-white px-2 py-1 disabled:opacity-80",
						)}
						onClick={async () => {
							const name = prompt("please input book name:");
							if (!name) {
								return;
							}
							setCreating(true);
							try {
								const store = await StorageAPI.createStore(name);
								await useBookStore.getState().updateBookList();
							} finally {
								setCreating(false);
							}
						}}
					>
						{creating && <Loading />}Create new book
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
