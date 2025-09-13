import { Collapsible } from "radix-ui";
import { useState } from "react";
import { StorageDeferredAPI } from "@/api/storage";
import Clearable from "@/components/clearable";
import { DatePicker } from "@/components/date-picker";
import Ledger from "@/components/ledger";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreators } from "@/hooks/use-creator";
import { BillCategories } from "@/ledger/category";
import type { Bill, BillCategory, BillFilter, BillType } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

function RangeInput({
	value,
	onChange,
	onBlur,
}: {
	value: number | undefined;
	onChange?: (v?: number) => void;
	onBlur?: () => void;
}) {
	return (
		<Clearable
			visible
			className="relative rounded-full shadow px-2 truncate py-2 cursor-pointer hover:text-accent-foreground group range-input"
			onClear={() => onChange?.(undefined)}
		>
			{value === undefined && (
				<span className="absolute pointer-events-none group-[.range-input:focus-within]:hidden">
					Unlimited
				</span>
			)}
			<input
				type="number"
				className="max-w-[50px] h-[20px] bg-transparent outline-none text-right py-1"
				value={value ?? ""}
				onChange={(e) => {
					onChange?.(Number(e.target.value));
				}}
				onBlur={onBlur}
			></input>
		</Clearable>
	);
}

function DateInput({
	value,
	onChange,
	onBlur,
	type,
}: {
	value: number | undefined;
	onChange?: (v?: number) => void;
	onBlur?: () => void;
	type: "start" | "end";
}) {
	return (
		<Clearable
			visible
			className="rounded-full shadow px-2 truncate py-2 cursor-pointer hover:text-accent-foreground"
			onClear={() => onChange?.(undefined)}
		>
			<DatePicker
				value={value}
				displayFormatter={(v) =>
					v === undefined
						? type === "start"
							? "From: oldest"
							: "To: newest"
						: `${type === "start" ? "From" : "To"}: ${v.format("YYYY/MM/DD")}`
				}
				onChange={(e) => onChange?.(e)}
				onBlur={onBlur}
			/>
		</Clearable>
	);
}

export default function Page() {
	const [form, setForm] = useState<BillFilter>({});

	const setTime = (v: number | undefined, type: "start" | "end") => {
		setForm((prev) => {
			if (type === "start") {
				const pair =
					v === undefined
						? [v, prev.end]
						: v > (prev.end ?? Infinity)
							? [prev.end, v]
							: [v, prev.end];
				return { ...prev, start: pair[0], end: pair[1] };
			}
			const pair =
				v === undefined
					? [prev.start, v]
					: v > (prev.start ?? -Infinity)
						? [prev.start, v]
						: [v, prev.start];
			return { ...prev, start: pair[0], end: pair[1] };
		});
	};

	const formatForm = () => { };

	const creators = useCreators();
	const allCreators = Array.from(Object.entries(creators)).map(
		([id, { info }]) => ({ id, name: info.name }),
	);
	const { infos } = useLedgerStore();
	const allCategories = infos?.categories ?? BillCategories;
	const categories = BillCategories.filter((cate) =>
		form.type === undefined ? true : cate.type === form.type,
	).reduce(
		(p, c) => {
			const found = p.find((v) => v.type === c.type);
			if (found) {
				found.list.push(c);
				return p;
			}
			p.push({ type: c.type, list: [c] });
			return p;
		},
		[] as { type: BillType; list: BillCategory[] }[],
	);

	const [list, setList] = useState<Bill[]>([]);
	const toSearch = async () => {
		console.log('search start', 'res')
		const book = useBookStore.getState().currentBookId;
		if (!book) {
			return;
		}
		const result = await StorageDeferredAPI.filter(book, form);
		console.log(result, 'res')
		setList(result);
	};

	return (
		<div className="w-full h-full p-2 flex justify-center overflow-hidden">
			<div className="h-full w-full mx-2 max-w-[600px] flex flex-col">
				<div className="search w-full flex justify-center pt-4">
					<div className="w-full h-10 shadow-md rounded-sm flex items-center px-4 focus-within:(shadow-lg)">
						<div className="flex-1">
							<Clearable
								visible={Boolean(form.comment?.length)}
								onClear={() => setForm((v) => ({ ...v, comment: undefined }))}
							>
								<input
									value={form.comment ?? ""}
									type="text"
									maxLength={50}
									className="w-full bg-transparent outline-none"
									onChange={(e) => {
										setForm((v) => ({ ...v, comment: e.target.value }));
									}}
								/>
							</Clearable>
						</div>
						<Button
							variant="ghost"
							className="p-3 rounded-full"
							onClick={toSearch}
						>
							<i className="icon-[mdi--search]"></i>
						</Button>
					</div>
				</div>
				<Collapsible.Root className="flex flex-col group pt-2 text-xs sm:text-sm">
					<Collapsible.Content asChild>
						<div className="flex flex-col gap-2 overflow-hidden data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close">
							<div className="w-full flex justify-between items-center">
								<DateInput
									value={form.start}
									type="start"
									onChange={(v) => setForm((prev) => ({ ...prev, start: v }))}
									onBlur={formatForm}
								/>
								<DateInput
									value={form.end}
									type="end"
									onChange={(v) => setForm((prev) => ({ ...prev, end: v }))}
									onBlur={formatForm}
								/>
							</div>
							<div className="w-full flex justify-between items-center">
								<div>
									<i></i>
									Type:
								</div>
								<div className="flex rounded-full shadow overflow-hidden">
									<button
										type="button"
										className={`w-20 text-center py-1 buttoned cursor-pointer transition-colors duration-200 ${form.type === "income" ? "!bg-stone-700 !text-white" : ""
											}`}
										onClick={() => setForm((v) => ({ ...v, type: "income" }))}
									>
										{"income"}
									</button>
									<button
										type="button"
										className={`w-20 text-center py-1 buttoned cursor-pointer transition-colors duration-200 ${form.type === "expense" ? "!bg-stone-700 !text-white" : ""
											}`}
										onClick={() => setForm((v) => ({ ...v, type: "expense" }))}
									>
										{"expenses"}
									</button>
									<button
										type="button"
										className={`w-20 text-center py-1 buttoned cursor-pointer transition-colors duration-200 ${form.type === undefined ? "!bg-stone-700 !text-white" : ""
											}`}
										onClick={() => setForm((v) => ({ ...v, type: undefined }))}
									>
										{"all"}
									</button>
								</div>
							</div>
							<div className="w-full flex justify-between items-center">
								<div>
									<i></i>
									Range:
								</div>
								<div className="flex items-center gap-4">
									<RangeInput
										value={form.minAmount}
										onChange={(v) =>
											setForm((prev) => ({ ...prev, minMoney: v }))
										}
										onBlur={formatForm}
									/>
									<div> - </div>
									<RangeInput
										value={form.maxAmount}
										onChange={(v) =>
											setForm((prev) => ({ ...prev, maxMoney: v }))
										}
										onBlur={formatForm}
									/>
								</div>
							</div>
							<div className="w-full flex justify-between items-center">
								<div>
									<i></i>
									Categories:
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline">Open</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{categories.map((folder) => {
											return (
												<>
													<DropdownMenuLabel>{folder.type}</DropdownMenuLabel>
													{folder.list.map((item) => (
														<DropdownMenuCheckboxItem
															key={item.id}
															checked={
																form.categories
																	? form.categories.includes(item.id)
																	: true
															}
															onCheckedChange={(v) => {
																setForm((prev) => {
																	const set = new Set(
																		prev.categories ??
																		allCategories.map((c) => c.id),
																	);
																	if (v) {
																		set.add(item.id);
																	} else {
																		set.delete(item.id);
																	}
																	const newCategories = Array.from(set);
																	return {
																		...prev,
																		categories: newCategories,
																	};
																});
															}}
														>
															{item.name}
														</DropdownMenuCheckboxItem>
													))}
												</>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<div className="w-full flex justify-between items-center">
								<div>
									<i></i>
									Users:
								</div>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline">Open</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										<DropdownMenuLabel>Appearance</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{allCreators.map((item) => (
											<DropdownMenuCheckboxItem
												key={item.id}
												checked={
													form.creators ? form.creators.includes(item.id) : true
												}
												onCheckedChange={(v) => {
													setForm((prev) => {
														const set = new Set(
															prev.creators ?? allCreators.map((c) => c.id),
														);
														if (v) {
															set.add(item.id);
														} else {
															set.delete(item.id);
														}
														const newCreators = Array.from(set);
														return {
															...prev,
															creators: newCreators,
														};
													});
												}}
											>
												{item.name}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<div className="h-2"></div>
						</div>
					</Collapsible.Content>
					<div className="w-full flex justify-between px-2">
						<Button variant="ghost">Reset</Button>
						<Collapsible.Trigger asChild>
							<Button variant="ghost">
								<i className="group-[[data-state=open]]:icon-[mdi--filter-variant-minus] group-[[data-state=closed]]:icon-[mdi--filter-variant-plus]"></i>
								Filter
							</Button>
						</Collapsible.Trigger>
					</div>
				</Collapsible.Root>
				<Ledger bills={list} />
			</div>

		</div>
	);
}
