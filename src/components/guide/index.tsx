import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";

export default function Guide() {
	const isLogin = useUserStore(
		useShallow((state) => Boolean(state.login) && state.id > 0),
	);
	const [bookNum] = useBookStore(
		useShallow((state) => {
			return [state.books.length];
		}),
	);
	if (!isLogin || bookNum > 0) {
		return null;
	}
	return createPortal(
		<div className="fixed top-0 right-0 z-[9999] w-screen h-screen overflow-hidden">
			<div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
			<div className="w-full h-full flex justify-center items-center">
				<div className="bg-[white] w-[350px] h-[350px] flex justify-center items-center rounded">
					<button
						type="button"
						className="rounded bg-black text-white px-2 py-1"
						onClick={async () => {
							const name = prompt("please input book name:");
							if (!name) {
								return;
							}
							const store = await StorageAPI.createStore(name);
							await StorageAPI.initStore(store.fullName);
						}}
					>
						Create new book
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
