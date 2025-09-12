import { Switch } from "radix-ui";
import { useRef, useState } from "react";
import {
	amountToNumber,
	isValidNumberForAmount,
	numberToAmount,
} from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import type { EditBill } from "@/store/ledger";
import { cn } from "@/utils";
import { DatePicker } from "../date-picker";
import { FORMAT_IMAGE_SUPPORTED, showFilePicker } from "../file-picker";
import SmartImage from "../image";

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

	const categories =
		billState.type === "expense" ? ExpenseBillCategories : IncomeBillCategories;

	const toConfirm = () => {
		onConfirm?.({
			...billState,
		});
	};

	const chooseImage = async () => {
		const [file] = await showFilePicker({ accept: FORMAT_IMAGE_SUPPORTED });
		setBillState((v) => ({ ...v, image: file }));
	};

	const commentInputEl = useRef<HTMLInputElement>(null);
	return (
		<div className="w-full h-full flex flex-col">
			{/* header */}
			<div className="header flex pt-2">
				<button
					type="button"
					className="flex buttoned rounded-full py-1 px-3 cursor-pointer"
					onClick={goBack}
				>
					<div className="flex items-center justify-center">
						<i className="icon-[mdi--chevron-left]"></i>
					</div>
					{/* @todo: 替换为 i18n hook */}
					{"back"}
				</button>
			</div>

			{/* input area */}
			<div className="w-full min-h-20 rounded-lg flex p-2 pb-0">
				<div className="text-white">
					<Switch.Root
						className="w-34 h-20 relative bg-stone-900 rounded-lg p-2 flex justify-center items-center"
						checked={billState.type === "income"}
						onCheckedChange={() => {
							setBillState((v) => ({
								...v,
								type: v.type === "expense" ? "income" : "expense",
								categoryId: v.type === "expense"
									? IncomeBillCategories[0].id
									: ExpenseBillCategories[0].id
							}));
						}}
					>
						<Switch.Thumb className="w-1/2 h-full flex justify-center items-center transition-all rounded-md bg-red-700 data-[state=checked]:bg-green-700 -translate-x-[28px] data-[state=checked]:translate-x-[28px]">
							<span className="text-xs">
								{billState.type === "expense" ? "expense" : "income"}
							</span>
						</Switch.Thumb>
					</Switch.Root>
				</div>
				<div className="flex-1 flex flex-col justify-center items-end bg-stone-400 rounded-lg ml-2 p-2 overflow-x-scroll">
					<input
						value={amountToNumber(billState.amount)}
						onChange={(e) => {
							const n = Number(e.target.value);
							if (!isValidNumberForAmount(n)) {
								alert("invalid amount number");
							}
							setBillState((v) => ({
								...v,
								amount: numberToAmount(n),
							}));
						}}
						inputMode="decimal"
						placeholder="0"
						type="number"
						className="text-white text-4xl font-semibold focus:(border-none outline-none) text-right bg-transparent appearance-remove-all placeholder-white placeholder-opacity-50"
					/>
				</div>
			</div>

			{/* categories */}
			<div className="sm:flex-1 flex-shrink-0 min-h-100px overflow-y-auto my-2 px-2">
				<div className="flex flex-wrap justify-between">
					{categories.map((item) => (
						<button
							type="button"
							key={item.id}
							className={cn(
								`rounded-lg border  flex-1 py-1 px-2 my-1 mr-1 h-8 flex items-center justify-center whitespace-nowrap cursor-pointer`,
								billState.categoryId === item.id
									? "bg-slate-700 text-white "
									: "bg-stone-200  text-light-900",
							)}
							onMouseDown={() =>
								setBillState((v) => ({ ...v, categoryId: item.id }))
							}
						>
							<i className={`icon-xs ${item.icon}`}></i>
							<div className="mx-2">{item.name}</div>
						</button>
					))}
				</div>
			</div>

			{/* keyboard area */}
			<div className="keyboard-field flex-1 flex flex-col justify-start bg-stone-900 rounded-b-lg text-[white] p-2">
				<div className="mb-1 flex justify-between items-center p-2">
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
						<input
							ref={commentInputEl}
							value={billState.comment}
							onChange={(e) => {
								setBillState((v) => ({ ...v, comment: e.target.value }));
							}}
							type="text"
							className="w-full bg-transparent text-white text-right placeholder-opacity-50 focus:(border-none outline-none)"
							placeholder={"comment"}
							enterKeyHint="done"
						/>
					</div>
				</div>

				<button
					type="button"
					className="flex h-[80px] justify-center items-center bg-green-700 rounded-lg m-2 font-bold text-lg cursor-pointer"
					onClick={toConfirm}
				>
					<i className="icon-[mdi--check] icon-md"></i>
				</button>
			</div>
		</div>
	);
}
