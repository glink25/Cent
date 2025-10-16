import {
    SelectContent,
    SelectPortal,
    SelectViewport,
} from "@radix-ui/react-select";
import { RadioGroup } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import {
    Select,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import PopupLayout from "@/layouts/popup-layout";
import { numberToAmount } from "@/ledger/bill";
import { BillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";
import Loading from "../loading";
import { Button } from "../ui/button";

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
    const t = useIntl();
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
                        ? edit?.data.data.find((v) => v.tableName === "bills")
                              ?.rows
                        : edit?.data.data.find((v) => v.tableName === row.id)
                              ?.rows,
                };
            })
            .filter((v) => v.data?.length);
    }, [edit]);

    const [loading, setLoading] = useState(false);
    const toConfirm = async () => {
        const selected = data?.find((v) => v.user.id === selectedUserId);
        if (!selected) {
            return;
        }
        setLoading(true);
        try {
            await useLedgerStore
                .getState()
                .batchImportFromBills(
                    selected.data?.map((v) => transferToBill(v as BillRow)) ??
                        [],
                    importStrategy === "overlap",
                );
            toast.success(t("import-success"));
            onConfirm?.(true);
            setLoading(false);
        } catch (error) {
            toast.error(`${t("import-failed")}: ${error}`);
            onConfirm?.(false);
        }
    };
    return (
        <PopupLayout onBack={onCancel} title="Oncent">
            <div className="flex flex-col p-4 gap-4 h-full">
                <div className="flex-1 flex flex-col gap-4">
                    <Select
                        value={selectedUserId}
                        onValueChange={(v) => setSelectedUserId(v)}
                    >
                        <SelectTrigger
                            className="SelectTrigger"
                            aria-label="Food"
                        >
                            <SelectValue placeholder={t("select-a-user")} />
                        </SelectTrigger>
                        <SelectPortal>
                            <SelectContent className="bg-white shadow">
                                <SelectViewport className="SelectViewport">
                                    {data?.map((item) => {
                                        return (
                                            <SelectItem
                                                key={item.user.id}
                                                value={item.user.id}
                                            >
                                                {`${item.user.nickname}(${item.data?.length})`}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectViewport>
                            </SelectContent>
                        </SelectPortal>
                    </Select>
                    <div className="flex flex-col gap-4">
                        {t("import-strategy")}:
                        <RadioGroup.Root
                            className="flex items-center gap-4"
                            defaultValue={importStrategy}
                            onValueChange={(v) => {
                                setImportStrategy(v as any);
                            }}
                        >
                            <div className="flex gap-2 items-center">
                                <RadioGroup.Item
                                    className="w-6 h-6 rounded-full border flex justify-center items-center"
                                    value="add"
                                >
                                    <RadioGroup.Indicator className="block w-4 h-4 rounded-full bg-stone-900" />
                                </RadioGroup.Item>
                                <label className="Label" htmlFor="r1">
                                    {t("strategy-add")}
                                </label>
                            </div>
                            {/* <div className="flex gap-2 items-center">
							<RadioGroup.Item
								className="w-6 h-6 rounded-full border flex justify-center items-center"
								value="overlap"
							>
								<RadioGroup.Indicator className="block w-4 h-4 rounded-full bg-stone-900" />
							</RadioGroup.Item>
							<label className="Label" htmlFor="r2">
								{t("strategy-overlap")}
							</label>
						</div> */}
                        </RadioGroup.Root>
                    </div>
                </div>
                <div className="flex justify-end gap-2 items-center">
                    <Button variant="ghost" onClick={() => onCancel?.()}>
                        {t("cancel")}
                    </Button>
                    <Button disabled={loading} onClick={toConfirm}>
                        {loading && <Loading />} {t("confirm")}
                    </Button>
                </div>
            </div>
        </PopupLayout>
    );
}

function Title() {
    const t = useIntl();
    return t("import-from-oncent");
}

export const [OncentImport, showOncentImport] = createConfirmProvider(
    OncentImportForm,
    {
        dialogTitle: <Title />,
        dialogModalClose: false,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md data-[state=open]:animate-slide-from-right sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
    },
);
