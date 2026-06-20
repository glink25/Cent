import {
    DefaultCurrencies,
    DefaultCurrencyId,
} from "@/api/currency/currencies";
import type { Full } from "@/database/stash";
import { BillCategories } from "@/ledger/category";
import type {
    Bill,
    BillCategory,
    BillTag,
    CustomCurrency,
    GlobalMeta,
} from "@/ledger/type";
import { appendCategories, intlCategory } from "@/ledger/utils";
import { BaseBillItem } from "../ledger/item";

type Creator = { id: string | number; name?: string };

export type MergedResolvers = {
    resolveCategory: (
        id: string,
    ) => Pick<BillCategory, "icon" | "name"> | undefined;
    resolveTags: (ids: string[] | undefined) => BillTag[];
    resolveCreatorLabel: (creatorId: Bill["creatorId"]) => string;
    resolveCurrency: (
        target: string | undefined,
    ) => { symbol: string } | undefined;
};

/**
 * 构建"假设合并后"的解析函数，纯计算，绝不写入任何 store。
 * 合并规则镜像 importFromPreviewResult（preview-form.tsx）。
 */
export const buildMergedResolvers = ({
    currentMeta,
    incomingMeta,
    strategy,
    asMine,
    creators,
    meLabel,
    unknownLabel,
    t,
}: {
    currentMeta?: GlobalMeta;
    incomingMeta?: GlobalMeta;
    strategy: "append" | "overlap";
    asMine: boolean;
    creators: Creator[];
    meLabel: string;
    unknownLabel: string;
    t: (key: string) => string;
}): MergedResolvers => {
    // 分类：append → 追加合并；overlap → 以导入数据为准
    const mergedCategories: BillCategory[] = (() => {
        if (strategy === "overlap") {
            return incomingMeta?.categories ?? BillCategories;
        }
        const currentCategories =
            (currentMeta?.categories?.length ?? 0) === 0
                ? BillCategories
                : currentMeta!.categories!;
        return appendCategories(currentCategories, [
            ...(incomingMeta?.categories ?? []),
        ]);
    })();
    const categoryMap = new Map(mergedCategories.map((c) => [c.id, c]));

    // tags：以 id 为键合并，导入数据优先
    const tagMap = new Map<string, BillTag>();
    for (const tag of currentMeta?.tags ?? []) {
        tagMap.set(tag.id, tag);
    }
    for (const tag of incomingMeta?.tags ?? []) {
        tagMap.set(tag.id, tag);
    }

    // 币种：现有自定义 + 导入自定义 + 默认
    const currencyMap = new Map<string, { symbol: string }>();
    const addCurrencies = (list: CustomCurrency[] | undefined) => {
        for (const c of list ?? []) {
            currencyMap.set(c.id, { symbol: c.symbol });
        }
    };
    addCurrencies(currentMeta?.customCurrencies);
    addCurrencies(incomingMeta?.customCurrencies);
    for (const c of DefaultCurrencies) {
        if (!currencyMap.has(c.id)) {
            currencyMap.set(c.id, { symbol: c.symbol });
        }
    }
    const baseCurrencyId = currentMeta?.baseCurrency ?? DefaultCurrencyId;

    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    return {
        resolveCategory: (id) => {
            const c = categoryMap.get(id);
            return c ? intlCategory(c, t) : undefined;
        },
        resolveTags: (ids) =>
            (ids ?? [])
                .map((id) => tagMap.get(id))
                .filter((v): v is BillTag => v !== undefined),
        resolveCreatorLabel: (creatorId) => {
            if (asMine) {
                return meLabel;
            }
            return creatorMap.get(creatorId)?.name ?? unknownLabel;
        },
        resolveCurrency: (target) => {
            if (!target || target === baseCurrencyId) {
                return undefined;
            }
            return currencyMap.get(target);
        },
    };
};

/** 预览专用账单条目：基于合并后 meta 解析，纯展示，不可点击。 */
export const PreviewBillItem = ({
    bill,
    resolvers,
    showTime,
    showAssets,
    className,
}: {
    bill: Full<Bill>;
    resolvers: MergedResolvers;
    showTime?: boolean;
    showAssets?: boolean;
    className?: string;
}) => {
    return (
        <BaseBillItem
            category={resolvers.resolveCategory(bill.categoryId)}
            tags={resolvers.resolveTags(bill.tagIds)}
            creatorLabel={resolvers.resolveCreatorLabel(bill.creatorId)}
            targetCurrency={resolvers.resolveCurrency(bill.currency?.target)}
            currencyAmount={bill.currency?.amount}
            type={bill.type}
            amount={bill.amount}
            time={bill.time}
            comment={bill.comment}
            images={bill.images}
            showTime={showTime}
            showAssets={showAssets}
            className={className}
        />
    );
};
