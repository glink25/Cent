import { useShallow } from "zustand/shallow";
import { LoginAPI } from "./api/login";
import { useBookStore } from "./store/book";
import { useLedgerStore } from "./store/ledger";
import { useUserStore } from "./store/user";

function App() {
	const { login } = LoginAPI;

	const [userName] = useUserStore(
		useShallow((state) => {
			return [state.name];
		}),
	);

	const [books] = useBookStore(
		useShallow((state) => {
			return [state.books];
		}),
	);
	console.log(books, "bboks");

	const toAddNewBook = async () => {
		const result = prompt("Please input book name:");
		if (result === null) {
			return;
		}
		await useBookStore.getState().addBook(result);
	};

	const toDeleteBook = async (id: number, name: string) => {
		const ok = confirm(`Sure to delete book [${name}]`);
		if (!ok) {
			return;
		}
		await useBookStore.getState().deleteBook(id);
	};

	const [entries] = useLedgerStore(
		useShallow((state) => {
			return [state.entries];
		}),
	);
	const toDeleteEntry = (id: any) => {
		useLedgerStore.getState().deleteEntry(id);
	};

	const toAddEntry = () => {
		useLedgerStore.getState().addEntry({
			amount: Math.floor(Math.random() * 1000),
			comment: `comment-${Date.now()}`,
		});
	};

	return (
		<div>
			<div>
				<button
					type="button"
					className="rounded border border-slate-900"
					onClick={() => {
						login();
					}}
				>
					login
				</button>
				<div>userName: {userName}</div>
				<div className="flex flex-col">
					Books:
					{books.map((book) => {
						return (
							<div key={book.id}>
								Name: {book.id}
								<div></div>
								<div>
									<button
										type="button"
										className="bg-red-500"
										onClick={() => toDeleteBook(1, "")}
									>
										delete
									</button>
								</div>
							</div>
						);
					})}
					<button type="button" className="bg-green-500" onClick={toAddNewBook}>
						add new book
					</button>
				</div>

				<div>
					<div>
						<button type="button" onClick={() => toAddEntry()}>
							add
						</button>
						<button
							type="button"
							onClick={() => {
								useLedgerStore.getState().updateEntryList();
							}}
						>
							update
						</button>
					</div>
					<div>
						{entries.map((v) => {
							return (
								<div className="" key={v.id}>
									{JSON.stringify(v)}

									<button type="button" onClick={() => toDeleteEntry(v.id)}>
										delete
									</button>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
