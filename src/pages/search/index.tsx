import { Collapsible } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { v4 } from "uuid";
import { type GlobalMeta, StorageAPI, StorageDeferredAPI } from "@/api/storage";
import Clearable from "@/components/clearable";
import { DatePicker } from "@/components/date-picker";
import Ledger from "@/components/ledger";
import Tag from "@/components/tag";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreators } from "@/hooks/use-creator";
import type { Bill, BillCategory, BillFilter, BillType } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

export default function Page() {
	const t = useIntl();
	const [form, setForm] = useState<BillFilter>({});

	const toReset = () => {
		setForm({});
	};

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

	const formatForm = () => {};

	const creators = useCreators();
	const allCreators = Array.from(Object.entries(creators)).map(
		([id, { info }]) => ({ id, name: info.name }),
	);
	const { infos } = useLedgerStore();
	const allCategories = infos?.categories ?? [];
	const categories = allCategories
		.filter((cate) =>
			form.type === undefined ? true : cate.type === form.type,
		)
		.reduce(
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
	const [searched, setSearched] = useState(false);
	const toSearch = async () => {
		const book = useBookStore.getState().currentBookId;
		setSearched(true);
		if (!book) {
			return;
		}
		const result = await StorageDeferredAPI.filter(book, form);
		setList(result);
	};

	const formatCategories = (ids?: string[]) => {
		if (ids === undefined) {
			return t("all");
		}
		if (ids.length === categories.reduce((p, c) => p + c.list.length, 0)) {
			return t("all");
		}
		return ids
			.map((id) => t(allCategories.find((v) => v.id === id)?.name ?? id))
			.join(",");
	};

	const formatCreators = (ids?: (number | string)[]) => {
		if (ids === undefined) {
			return t("all");
		}
		if (ids.length === allCreators.length) {
			return t("all");
		}
		return ids
			.map((id) => allCreators.find((v) => v.id === id)?.name ?? id)
			.join(",");
	};

	const dateType = form.recent === undefined ? "date" : "recent";

	const navigate = useNavigate();
	const toSaveFilter = async () => {
		const name = prompt(t("please-enter-a-name-for-current-filter"));
		if (!name) {
			return;
		}
		const book = useBookStore.getState().currentBookId;
		if (!book) {
			return;
		}
		const id = v4();
		await useLedgerStore.getState().updateGlobalMeta((prev) => {
			if (prev.customFilters === undefined) {
				prev.customFilters = [];
			}
			prev.customFilters.push({
				id,
				filter: form,
				name,
			});
			return prev;
		});
		navigate(`/stat/${id}`);
	};
	return (
		<div className="w-full h-full p-2 flex justify-center overflow-hidden">
			<div className="h-full w-full px-2 max-w-[600px] flex flex-col">
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
							className="p-3 rounded-md"
							onClick={toSearch}
						>
							<i className="icon-[mdi--search]"></i>
						</Button>
					</div>
				</div>
				<Collapsible.Root className="flex flex-col group pt-3 text-xs md:text-sm font-medium">
					<Collapsible.Content asChild>
						<div className="flex flex-col gap-3 border-b data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
							{/* time selector */}
							<div className="flex justify-between items-center gap-4">
								<Select
									value={dateType}
									onValueChange={(v) => {
										if (v === "recent") {
											setForm((prev) => ({
												...prev,
												recent: { value: 1, unit: "month" },
											}));
											return;
										}
										setForm((prev) => ({ ...prev, recent: undefined }));
									}}
								>
									<SelectTrigger className="w-fit px-2 py-2 md:px-4 text-xs md:text-sm">
										<SelectValue></SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="date">{t("as-date")}</SelectItem>
										<SelectItem value="recent">{t("recent")}</SelectItem>
									</SelectContent>
								</Select>
								{dateType === "date" ? (
									<div className="flex justify-between items-center">
										<DateInput
											value={form.start}
											type="start"
											onChange={(v) =>
												setForm((prev) => ({ ...prev, start: v }))
											}
											onBlur={formatForm}
										/>
										<div className="px-4"> - </div>
										<DateInput
											value={form.end}
											type="end"
											onChange={(v) => setForm((prev) => ({ ...prev, end: v }))}
											onBlur={formatForm}
										/>
									</div>
								) : (
									<div className="flex justify-between items-center gap-2">
										<RangeInput
											value={form.recent?.value}
											onChange={(v) => {
												if (v === undefined) {
													return;
												}
												setForm((prev) => ({
													...prev,
													recent: {
														unit: prev.recent?.unit ?? "week",
														value: v,
													},
												}));
											}}
										/>
										<Select
											value={form.recent?.unit ?? "day"}
											onValueChange={(v) => {
												setForm((prev) => ({
													...prev,
													recent: {
														value: prev.recent?.value ?? 1,
														unit: v as any,
													},
												}));
											}}
										>
											<SelectTrigger className="w-20 px-2 py-2 md:px-4 text-xs md:text-sm">
												<SelectValue></SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="day">{t("unit-day")}</SelectItem>
												<SelectItem value="week">{t("unit-week")}</SelectItem>
												<SelectItem value="month">{t("month")}</SelectItem>
												<SelectItem value="year">{t("year")}</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
							{/* type selector */}
							<div className="w-full flex justify-between items-center">
								<div className="flex items-center gap-1">
									<i className="icon-[mdi--arrow-collapse]"></i>
									{t("type")}:
								</div>
								<div className="flex rounded-md shadow border border-input overflow-hidden divide-x">
									<button
										type="button"
										className={`w-20 text-center pr-2 md:pl-4 py-2 text-xs h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
											form.type === "income" ? "!bg-stone-700 !text-white" : ""
										}`}
										onClick={() => setForm((v) => ({ ...v, type: "income" }))}
									>
										{t("income")}
									</button>
									<button
										type="button"
										className={`w-20 text-center py-2 h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
											form.type === "expense" ? "!bg-stone-700 !text-white" : ""
										}`}
										onClick={() => setForm((v) => ({ ...v, type: "expense" }))}
									>
										{t("expense")}
									</button>
									<button
										type="button"
										className={`w-20 text-center pr-2 md:pr-4 py-2 h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
											form.type === undefined ? "!bg-stone-700 !text-white" : ""
										}`}
										onClick={() => setForm((v) => ({ ...v, type: undefined }))}
									>
										{t("all")}
									</button>
								</div>
							</div>
							{/* amount range */}
							<div className="w-full flex justify-between items-center">
								<div className="flex items-center gap-1">
									<i className="icon-[mdi--scale-unbalanced]"></i>
									{t("range")}:
								</div>
								<div className="flex items-center gap-4">
									<RangeInput
										value={form.minAmount}
										onChange={(v) =>
											setForm((prev) => ({ ...prev, minAmount: v }))
										}
										onBlur={formatForm}
									/>
									<div> - </div>
									<RangeInput
										value={form.maxAmount}
										onChange={(v) =>
											setForm((prev) => ({ ...prev, maxAmount: v }))
										}
										onBlur={formatForm}
									/>
								</div>
							</div>
							{/* category selector */}
							<div className="w-full flex justify-between items-center">
								<div className="flex items-center gap-1">
									<i className="icon-[mdi--category-plus-outline]"></i>
									{t("categories")}:
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="px-2 md:px-4 py-2 text-xs md:text-sm"
										>
											<div className="max-w-[120px] truncate">
												{formatCategories(form.categories)}
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{categories.map((folder) => {
											return (
												<>
													<DropdownMenuLabel>
														{t(folder.type)}
													</DropdownMenuLabel>
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
																	const newCategories =
																		set.size === 0
																			? prev.categories
																			: Array.from(set);
																	return {
																		...prev,
																		categories: newCategories,
																	};
																});
															}}
														>
															{t(item.name)}
														</DropdownMenuCheckboxItem>
													))}
												</>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							{/* user selector */}
							<div className="w-full flex justify-between items-center">
								<div className="flex items-center gap-1">
									<i className="icon-[mdi--user-details-outline]"></i>
									{t("users")}:
								</div>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="px-2 md:px-4 py-2 text-xs md:text-sm"
										>
											<div className="max-w-[120px] truncate">
												{formatCreators(form.creators)}
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56">
										{/* <DropdownMenuLabel>Appearance</DropdownMenuLabel>
										<DropdownMenuSeparator /> */}
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
														const newCreators =
															set.size === 0 ? prev.creators : Array.from(set);
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
							{/* other checkboxes */}
							<div className="w-full flex justify-between items-center">
								<div>{t("others")}:</div>
								<div className="flex-1 flex justify-end overflow-y-scroll gap-3">
									<Tag
										checked={form.assets}
										onCheckedChange={(v) => {
											setForm((prev) => ({ ...prev, assets: v }));
										}}
										className="text-xs bg-transparent shadow-md"
									>
										{t("with-assets")}
									</Tag>
								</div>
							</div>
							{/* placeholder */}
							<div className="h-2"></div>
						</div>
					</Collapsible.Content>
					<div className="w-full flex justify-between px-2 pt-1">
						<Button variant="ghost" onClick={toReset}>
							{t("reset")}
						</Button>
						{searched && (
							<Button
								className="text-xs underline animate-content-show"
								variant="ghost"
								size="sm"
								onClick={toSaveFilter}
							>
								<i className="icon-[mdi--coffee-to-go-outline]" />
								{t("save-for-analyze")}
							</Button>
						)}
						<Collapsible.Trigger asChild>
							<Button variant="ghost">
								<i className="group-[[data-state=open]]:icon-[mdi--filter-variant-minus] group-[[data-state=closed]]:icon-[mdi--filter-variant-plus]"></i>
								{t("filter")}
							</Button>
						</Collapsible.Trigger>
					</div>
				</Collapsible.Root>
				<Ledger bills={list} />
			</div>
		</div>
	);
}

function RangeInput({
	value,
	onChange,
	onBlur,
}: {
	value: number | undefined;
	onChange?: (v?: number) => void;
	onBlur?: () => void;
}) {
	const t = useIntl();
	return (
		<Clearable
			visible
			className="relative rounded-md shadow px-2 py-2 md:px-4 border border-input truncate cursor-pointer hover:text-accent-foreground group range-input"
			onClear={() => onChange?.(undefined)}
		>
			{value === undefined && (
				<span className="absolute pointer-events-none group-[.range-input:focus-within]:hidden pr-4">
					{t("unlimited")}
				</span>
			)}
			<input
				type="number"
				className="max-w-[64px] h-[18px] bg-transparent outline-none text-right"
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
	const t = useIntl();
	return (
		<Clearable
			visible
			className="rounded-md shadow px-2 py-2 md:px-4 border border-input truncate cursor-pointer hover:text-accent-foreground"
			onClear={() => onChange?.(undefined)}
		>
			<DatePicker
				value={value}
				displayFormatter={(v) =>
					v === undefined
						? type === "start"
							? t("from-oldest")
							: t("to-newest")
						: `${v.format("YYYY/MM/DD")}`
				}
				onChange={(e) => onChange?.(e)}
				onBlur={onBlur}
			/>
		</Clearable>
	);
}
