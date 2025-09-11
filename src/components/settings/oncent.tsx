import { RadioGroup, Select } from "radix-ui";
import { useMemo, useState } from "react";
import { v4 } from "uuid";
import { numberToAmount } from "@/ledger/bill";
import { BillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";

// 单条用户行
export interface UserRow {
	id: string;
	name: string;
	latestTransferTime: number;
	connectId: string;
	me: boolean;
}

// 单条账单行
interface BillRow {
	id: string; // 假设账单也有 id
	comment?: string;
	categoryId: string;
	time: number;
	creatorId: string;
	image?: File;
	money: number;
	type: number;
}

// 每张表的数据
interface TableData<T = any> {
	tableName: string;
	inbound: boolean;
	rows: T[];
}

// 数据库中表的元信息
interface TableSchema {
	name: string;
	schema: string;
	rowCount: number;
}

// 最外层数据库类型
interface DatabaseData {
	databaseName: string;
	databaseVersion: number;
	tables: TableSchema[];
	data: TableData[];
	formatName: string;
	formatVersion: number;
}

// 如果想要精确指定 users 表的行类型，可以写：
export type OncentDatabaseData = { data: DatabaseData };

const transferToBill = (row: BillRow): Omit<Bill, "creatorId"> => {
	const cate = BillCategories.find((v) => v.id === row.categoryId);
	const type = row.type === 1 ? "expense" : "income";
	const categoryId =
		cate?.id ?? (type === "income" ? "other-income" : "other-expenses");
	const comment = cate
		? row.comment
		: `${row.comment} ${JSON.stringify({ rawCategory: row.categoryId })}`;
	return {
		id: row.id ?? v4(),
		type: row.type === 1 ? "expense" : "income",
		categoryId: categoryId,
		comment,
		time: row.time * 1000,
		amount: numberToAmount(row.money),
	};
};

function OncentImportForm({
	edit,
	onCancel,
	onConfirm,
}: {
	edit?: OncentDatabaseData;
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const [selectedUserId, setSelectedUserId] = useState<string>();
	const [importStrategy, setImportStrategy] = useState<"add" | "overlap">(
		"add",
	);

	const data = useMemo(() => {
		const users = edit?.data.data.find((v) => v.tableName === "users");
		return users?.rows
			.map((_row) => {
				const row = _row as UserRow;
				return {
					user: {
						nickname: row.name,
						id: row.id,
					},
					data: row.me
						? edit?.data.data.find((v) => v.tableName === "bills")?.rows
						: edit?.data.data.find((v) => v.tableName === row.id)?.rows,
				};
			})
			.filter((v) => v.data?.length);
	}, [edit]);

	console.log(data, "import data");
	const toConfirm = async () => {
		const selected = data?.find((v) => v.user.id === selectedUserId);
		if (!selected) {
			return;
		}
		useLedgerStore
			.getState()
			.batchImport(
				selected.data?.map((v) => transferToBill(v as BillRow)) ?? [],
				importStrategy === "overlap",
			);
	};
	return (
		<div>
			<div>Oncent </div>
			<div>
				<Select.Root
					value={selectedUserId}
					onValueChange={(v) => setSelectedUserId(v)}
				>
					<Select.Trigger className="SelectTrigger" aria-label="Food">
						<Select.Value placeholder="Select a user" />
					</Select.Trigger>
					<Select.Portal>
						<Select.Content className="bg-white shadow">
							<Select.Viewport className="SelectViewport">
								{data?.map((item) => {
									return (
										<Select.Item key={item.user.id} value={item.user.id}>
											<Select.ItemText>{`${item.user.nickname}(${item.data?.length})`}</Select.ItemText>
										</Select.Item>
									);
								})}
							</Select.Viewport>
						</Select.Content>
					</Select.Portal>
				</Select.Root>
				<div>
					Import Strategy:
					<RadioGroup.Root
						className="flex items-center gap-4"
						defaultValue={importStrategy}
						onValueChange={(v) => {
							setImportStrategy(v as any);
						}}
						aria-label="View density"
					>
						<div style={{ display: "flex", alignItems: "center" }}>
							<RadioGroup.Item
								className="w-6 h-6 rounded-full border flex justify-center items-center"
								value="add"
							>
								<RadioGroup.Indicator className="block w-4 h-4 rounded-full bg-stone-900" />
							</RadioGroup.Item>
							<label className="Label" htmlFor="r1">
								Add
							</label>
						</div>
						<div style={{ display: "flex", alignItems: "center" }}>
							<RadioGroup.Item
								className="w-6 h-6 rounded-full border flex justify-center items-center"
								value="overlap"
							>
								<RadioGroup.Indicator className="block w-4 h-4 rounded-full bg-stone-900" />
							</RadioGroup.Item>
							<label className="Label" htmlFor="r2">
								Overlap
							</label>
						</div>
					</RadioGroup.Root>
				</div>
			</div>
			<div className="flex justify-end gap-2 items-center">
				<button type="button" onClick={() => onCancel?.()}>
					cancel
				</button>
				<button type="button" onClick={toConfirm}>
					confirm
				</button>
			</div>
		</div>
	);
}

export const [OncentImport, showOncentImport] = createConfirmProvider(
	OncentImportForm,
	{
		dialogTitle: "import from oncent",
		dialogModalClose: false,
	},
);
