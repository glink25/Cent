import { Dialog, VisuallyHidden } from "radix-ui";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import Loading from "../loading";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export default function BookGuide() {
	const t = useIntl();
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
	return (
		<Dialog.Root
			open={visible || currentBookId === undefined}
			onOpenChange={(v) => {
				console.log("v", v);
				if (!v) {
					useBookStore.setState((v) => ({ ...v, visible: false }));
				}
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlay-show"></Dialog.Overlay>
				<Dialog.Content>
					<VisuallyHidden.Root>
						<Dialog.Title>{t("select-a-book")}</Dialog.Title>
						<Dialog.Description>{t("select-a-book")}</Dialog.Description>
					</VisuallyHidden.Root>
					<div className="fixed top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none">
						<Dialog.Content
							className={cn(
								"bg-white max-h-[55vh] w-fit max-w-[500px] rounded-md data-[state=open]:animate-content-show",
							)}
						>
							<VisuallyHidden.Root>
								<Dialog.Title>{t("select-a-book")}</Dialog.Title>
								<Dialog.Description>{t("select-a-book")}</Dialog.Description>
							</VisuallyHidden.Root>
							<div className="w-fit h-full flex justify-center items-center pointer-events-auto">
								<div className="bg-[white] w-[350px] h-[450px] py-4 flex flex-col justify-center items-center rounded">
									{books.length > 0 ? (
										<div className="flex-1 flex flex-col w-full gap-2 h-full overflow-hidden">
											<div className="flex gap-2 px-4">
												{t("select-a-book")}
												{loading && <Loading></Loading>}
											</div>
											<div className="flex flex-col gap-2 px-4 overflow-y-auto">
												{books.map((book) => {
													return (
														<Label
															key={book.id}
															className="cursor-pointer hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950"
														>
															<Checkbox
																checked={book.id === currentBookId}
																onCheckedChange={(v) => {
																	console.log(book.id);
																	toSwitchBook(book.id);
																}}
																className="inline-flex items-center data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
															/>
															<div className="grid gap-1.5 font-normal py-2">
																<p className="text-sm leading-none font-medium">
																	{book.repo}
																</p>
															</div>
														</Label>
													);
												})}
											</div>
										</div>
									) : loading ? (
										<Loading>{t("loading-books")}</Loading>
									) : (
										<div className="flex-1">{t("no-books-go-create-one")}</div>
									)}
									<Button
										disabled={creating}
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
										{creating && <Loading />}
										{t("create-new-book")}
									</Button>
								</div>
							</div>
						</Dialog.Content>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function Book() {
	const t = useIntl();
	return (
		<div className="backup">
			<Button
				onClick={() => {
					useBookStore.setState((prev) => ({ ...prev, visible: true }));
				}}
				variant="ghost"
				className="w-full py-4 rounded-none h-auto"
			>
				<div className="w-full px-4 flex justify-between items-center">
					<div className="flex items-center gap-2">
						<i className="icon-[mdi--book-cog-outline] size-5"></i>
						{t("ledger-books")}
					</div>
					<i className="icon-[mdi--chevron-right] size-5"></i>
				</div>
			</Button>
		</div>
	);
}
