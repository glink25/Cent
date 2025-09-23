import { Switch } from "radix-ui";
import { useMemo, useState } from "react";
import useCategory from "@/hooks/use-category";
import PopupLayout from "@/layouts/popup-layout";
import { amountToNumber, numberToAmount } from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill, BillCategory } from "@/ledger/type";
import { useIntl } from "@/locale";
import type { EditBill } from "@/store/ledger";
import { cn } from "@/utils";
import { showCategoryList } from "../category";
import { DatePicker } from "../date-picker";
import { FORMAT_IMAGE_SUPPORTED, showFilePicker } from "../file-picker";
import SmartImage from "../image";
import IOSUnscrolledInput from "../input";
import Caculator from "../keyboard";

const defaultBill = {
	type: "expense" as Bill["type"],
	comment: "",
	amount: 0,
	categoryId: ExpenseBillCategories[0].id,
};

export default function EditorForm({
	edit,
	onCancel,
	onConfirm,
}: {
	edit?: EditBill;
	onConfirm?: (v: Omit<Bill, "id" | "creatorId">) => void;
	onCancel?: () => void;
}) {
	const t = useIntl();
	const goBack = () => {
		onCancel?.();
	};

	const [billState, setBillState] = useState({
		...defaultBill,
		time: Date.now(),
		...edit,
	});

	// useEffect(() => {
	// 	setBillState({ ...defaultBill, ...edit });
	// }, [edit]);
	const { incomes, expenses } = useCategory();

	const categories = billState.type === "expense" ? expenses : incomes;

	const subCategories = useMemo(() => {
		const selected = categories.find(
			(c) =>
				c.id === billState.categoryId ||
				c.children.some((s) => s.id === billState.categoryId),
		);
		if (selected?.children) {
			return selected.children;
		}
		return categories.find((c) => c.id === selected?.parent)?.children;
	}, [billState.categoryId, categories]);

	const toConfirm = () => {
		onConfirm?.({
			...billState,
		});
	};

	const chooseImage = async () => {
		const [file] = await showFilePicker({ accept: FORMAT_IMAGE_SUPPORTED });
		setBillState((v) => ({ ...v, image: file }));
	};

	return (
		<Caculator.Root
			initialValue={edit?.amount ? amountToNumber(edit?.amount) : 0}
			onValueChange={(n) => {
				setBillState((v) => ({
					...v,
					amount: numberToAmount(n),
				}));
			}}
		>
			<PopupLayout
				className="h-full"
				onBack={goBack}
				title={
					<div className="pl-[54px] w-full min-h-12 rounded-lg flex pt-2 pb-0">
						<div className="text-white">
							<Switch.Root
								className="w-24 h-12 relative bg-stone-900 rounded-lg p-1 flex justify-center items-center"
								checked={billState.type === "income"}
								onCheckedChange={() => {
									setBillState((v) => ({
										...v,
										type: v.type === "expense" ? "income" : "expense",
										categoryId:
											v.type === "expense"
												? IncomeBillCategories[0].id
												: ExpenseBillCategories[0].id,
									}));
								}}
							>
								<Switch.Thumb className="w-1/2 h-full flex justify-center items-center transition-all rounded-md bg-red-700 -translate-x-[22px] data-[state=checked]:bg-green-700 data-[state=checked]:translate-x-[21px]">
									<span className="text-[8px]">
										{billState.type === "expense" ? t("expense") : t("income")}
									</span>
								</Switch.Thumb>
							</Switch.Root>
						</div>
						<div className="flex-1 flex flex-col justify-center items-end bg-stone-400 rounded-lg ml-2 px-2 overflow-x-scroll">
							<Caculator.Value className="text-white text-3xl font-semibold focus:(border-none outline-none) text-right bg-transparent appearance-remove-all placeholder-white placeholder-opacity-50"></Caculator.Value>
						</div>
					</div>
				}
			>
				{/* categories */}
				<div className="flex-1 flex flex-col overflow-y-auto my-2 px-2 text-sm font-medium">
					<div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))]">
						{categories.map((item) => (
							<CategoryItem
								key={item.id}
								category={item}
								selected={billState.categoryId === item.id}
								onClick={() => {
									setBillState((v) => ({ ...v, categoryId: item.id }));
								}}
							/>
						))}
						<button
							type="button"
							className={cn(
								`rounded-lg border flex-1 py-1 px-2 my-1 mr-1 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
							)}
							onClick={() => {
								showCategoryList();
							}}
						>
							<i className="icon-[mdi--settings]"></i>
							编辑
						</button>
					</div>
					{(subCategories?.length ?? 0) > 0 && (
						<div className="flex-1 rounded-md border p-2 shadow">
							<div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))]">
								{subCategories?.map((subCategory) => {
									return (
										<CategoryItem
											key={subCategory.id}
											category={subCategory}
											selected={billState.categoryId === subCategory.id}
											onClick={() => {
												setBillState((v) => ({
													...v,
													categoryId: subCategory.id,
												}));
											}}
										/>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* keyboard area */}
				<div className="keyboard-field h-[480px] sm:h-[380px] flex-shrink-0 flex gap-2 flex-col justify-start bg-stone-900 sm:rounded-b-md text-[white] p-2 pb-[max(env(safe-area-inset-bottom),8px)]">
					<div className="flex justify-between items-center">
						<div className="flex items-center">
							<button
								type="button"
								className="mx-1 p-2 flex justify-center items-center rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500) cursor-pointer"
								onClick={chooseImage}
							>
								{!billState.image ? (
									<i className="icon-xs icon-[mdi--image-plus-outline] text-[white]"></i>
								) : (
									<SmartImage
										source={billState.image}
										alt=""
										className="w-6 h-6 object-cover rounded"
									/>
								)}
							</button>
							<div className="p-2 rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500)">
								<DatePicker
									value={billState.time}
									onChange={(time) => {
										setBillState((v) => ({ ...v, time: time }));
									}}
								/>
							</div>
						</div>
						<div className="flex h-full flex-1">
							<IOSUnscrolledInput
								value={billState.comment}
								onChange={(e) => {
									setBillState((v) => ({ ...v, comment: e.target.value }));
								}}
								type="text"
								className="w-full bg-transparent text-white text-right placeholder-opacity-50 outline-none"
								placeholder={t("comment")}
								enterKeyHint="done"
							/>
						</div>
					</div>

					<button
						type="button"
						className="flex h-[80px] justify-center items-center bg-green-700 rounded-lg font-bold text-lg cursor-pointer"
						onClick={toConfirm}
					>
						<i className="icon-[mdi--check] icon-md"></i>
					</button>
					<Caculator.Keyborad className="flex-1 grid-cols-[2fr_2fr_2fr_1fr_1fr]" />
				</div>
			</PopupLayout>
		</Caculator.Root>
	);
}

export function CategoryItem({
	category,
	selected,
	onClick,
	className,
}: {
	category: BillCategory;
	selected?: boolean;
	onClick: () => void;
	className?: string;
}) {
	const t = useIntl();
	return (
		<button
			type="button"
			className={cn(
				`rounded-lg border flex-1 py-1 px-2 my-1 mr-1 h-8 flex items-center justify-center whitespace-nowrap cursor-pointer`,
				selected ? "bg-slate-700 text-white " : "bg-stone-200  text-light-900",
				className,
			)}
			onMouseDown={onClick}
		>
			<i className={`icon-xs ${category.icon}`}></i>
			<div className="mx-2">{t(category.name)}</div>
		</button>
	);
}
