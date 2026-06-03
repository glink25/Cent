/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { useMemo } from "react";
import type { BillTag } from "@/components/bill-tag/type";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCurrency } from "@/hooks/use-currency";
import { useTag } from "@/hooks/use-tag";
import { amountToNumber } from "@/ledger/bill";
import type { Bill, BillCategory } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { denseTime } from "@/utils/time";
import CategoryIcon from "../category/icon";
import SmartImage from "../image";
import Money from "../money";

interface BaseBillItemProps {
    /** 已解析好（且已做 i18n）的分类 */
    category?: Pick<BillCategory, "icon" | "name">;
    /** 已解析好的标签列表 */
    tags?: Pick<BillTag, "id" | "name">[];
    /** 创建者展示文案（"我"/创建者名/unknown-user，由调用方决定） */
    creatorLabel: string;
    /** 非本位币时传入的目标币种 */
    targetCurrency?: { symbol: string };
    /** 账单基础字段 */
    type: Bill["type"];
    amount: Bill["amount"];
    time: Bill["time"];
    comment?: Bill["comment"];
    images?: Bill["images"];
    currencyAmount?: number;
    onClick?: () => void;
    className?: string;
    showTime?: boolean;
    showAssets?: boolean;
}

/** 纯展示组件，接收已解析好的数据，不依赖任何 store hook */
export function BaseBillItem({
    category,
    tags,
    creatorLabel,
    targetCurrency,
    type,
    amount,
    time,
    comment,
    images,
    currencyAmount,
    onClick,
    className,
    showTime,
    showAssets,
}: BaseBillItemProps) {
    return (
        <button
            type="button"
            className={cn(
                "bill-item flex justify-between items-center px-4 py-4 buttoned cursor-pointer",
                className,
            )}
            data-bill-tags={tags?.map((v) => v.name).join(" ")}
            onClick={onClick}
        >
            {/* 左侧图标 + 信息 */}
            <div className="flex items-center overflow-hidden">
                <div className="rounded-full bg-background border w-10 h-10 flex-shrink-0 flex items-center justify-center">
                    {category?.icon && <CategoryIcon icon={category.icon} />}
                </div>
                <div className="flex flex-col px-4 overflow-hidden">
                    <div className="flex text-md gap-1 h-6">
                        <div className="flex-shrink-0 font-semibold">
                            {category ? category.name : ""}
                        </div>
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {tags?.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="text-[10px] rounded border flex items-center p-[2px] h-3"
                                >
                                    {tag.name}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex text-xs">
                        <div>{creatorLabel}</div>
                        {comment && (
                            <>
                                <div className="px-1">|</div>
                                <div className="truncate">{comment}</div>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex-1 flex gap-2">
                    {showAssets &&
                        images?.map((img, i) => (
                            <SmartImage
                                key={i}
                                source={img}
                                alt=""
                                className="w-8 h-8 object-cover rounded data-[state=loading]:animate-pulse bg-primary/10"
                            />
                        ))}
                </div>
            </div>

            {/* 金额 */}
            <div className="bill-item-tail text-right">
                <div
                    className={`text-lg font-bold truncate flex-shrink-0 flex flex-col items-end ${
                        type === "expense"
                            ? "text-semantic-expense"
                            : type === "income"
                              ? "text-semantic-income"
                              : ""
                    }`}
                >
                    <Money value={amountToNumber(amount)} accurate />

                    {targetCurrency && currencyAmount !== undefined && (
                        <div className="text-xs">
                            {targetCurrency.symbol}
                            <Money
                                value={amountToNumber(currencyAmount)}
                                accurate
                            />
                        </div>
                    )}
                </div>

                {showTime && (
                    <div className="text-[8px] text-foreground/60">
                        {denseTime(time)}
                    </div>
                )}
            </div>
        </button>
    );
}

interface BillItemProps {
    bill: Bill;
    onClick?: () => void;
    className?: string;
    showTime?: boolean;
    showAssets?: boolean;
}

export default function BillItem({
    bill,
    className,
    onClick,
    showTime,
    showAssets,
}: BillItemProps) {
    const t = useIntl();
    const { categories } = useCategory();
    const { tags: allTags } = useTag();
    const category = useMemo(
        () => categories.find((c) => c.id === bill.categoryId),
        [bill.categoryId, categories],
    );

    const { id: selfId } = useUserStore();
    const creators = useCreators();
    const creator = creators.find((c) => c.id === bill.creatorId);
    const isMe = creator?.id === selfId;
    const tags = bill.tagIds
        ?.map((id) => allTags.find((t) => t.id === id))
        .filter((v) => v !== undefined);

    const { baseCurrency, allCurrencies } = useCurrency();
    const currency =
        bill.currency?.target === baseCurrency.id
            ? undefined
            : allCurrencies.find((c) => c.id === bill.currency?.target);

    return (
        <BaseBillItem
            category={category}
            tags={tags}
            creatorLabel={isMe ? t("me") : (creator?.name ?? "unknown-user")}
            targetCurrency={currency}
            currencyAmount={bill.currency?.amount}
            type={bill.type}
            amount={bill.amount}
            time={bill.time}
            comment={bill.comment}
            images={bill.images}
            onClick={onClick}
            className={className}
            showTime={showTime}
            showAssets={showAssets}
        />
    );
}
