import { Switch } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type { OutputType } from "@/gitray";
import {
	amountToNumber,
	isValidNumberForAmount,
	numberToAmount,
} from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import type { EditBill } from "@/store/ledger";

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
	onConfirm?: (v: Omit<Bill, "id">) => void;
	onCancel?: () => void;
}) {
	const goBack = () => {
		onCancel?.();
	};

	const [billState, setBillState] = useState({ ...defaultBill, ...edit });

	// useEffect(() => {
	// 	setBillState({ ...defaultBill, ...edit });
	// }, [edit]);

	const categories =
		billState.type === "expense" ? ExpenseBillCategories : IncomeBillCategories;

	const toConfirm = () => {
		console.log(billState, "new bill");
		const time = Date.now();
		onConfirm?.({
			createAt: time,
			...billState,
			updateAt: time,
		});
	};

	const commentInputEl = useRef<HTMLInputElement>(null);
	return (
		<div className="w-full h-full flex flex-col justify-between">
			{/* header */}
			<div className="header flex pt-2">
				<button
					type="button"
					className="flex buttoned rounded-full py-1 px-3 cursor-pointer"
					onClick={goBack}
				>
					<div className="flex items-center justify-center">
						<i className="icon-chevron-left"></i>
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
							}));
						}}
					>
						<Switch.Thumb className="block w-1/2 h-[calc(100%-8px)] transition-all rounded-lg absolute left-0 bg-red-700 data-[state=checked]:bg-green-700 data-[state=checked]:left-[unset] data-[state=checked]:right-0"></Switch.Thumb>
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
							className={`rounded-lg bg-stone-200 border  flex-1 py-1 px-2 my-1 mr-1 h-8 flex items-center justify-center whitespace-nowrap cursor-pointer ${
								billState.categoryId === item.id
									? "bg-gray-600 text-light-900"
									: "text-stone-700"
							}`}
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
			<div className="keyboard-field <sm:(flex-1) flex flex-col justify-start bg-stone-900 rounded-b-lg text-[white] p-2">
				<div className="mb-1 flex justify-between items-center p-2">
					<div className="flex items-center">
						{/* <button
							type="button"
							className="mx-1 p-2 flex justify-center items-center rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500) cursor-pointer"
							onClick={chooseImage}
						>
							{!image.value ? (
								<i className="icon-xs icon-image text-[white]"></i>
							) : (
								<img
									src={image.value.url}
									alt=""
									className="w-6 h-6 object-cover rounded"
								/>
							)}
						</button> */}
						<div className="p-2 rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500)">
							{/* <DateTime value={time.value} onChange={(v) => (time.value = v)} /> */}
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
					className="flex h-80px justify-center items-center bg-green-700 rounded-lg m-2 font-bold text-lg cursor-pointer"
					onClick={toConfirm}
				>
					<i className="icon-[mdi-light--check] icon-md"></i>
				</button>
			</div>
		</div>
	);
}
