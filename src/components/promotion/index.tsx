/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { useIntl } from "@/locale";
import { useGuideStore } from "@/store/guide";
import { useLedgerStore } from "@/store/ledger";
import { showBudget } from "../budget";
import { showCurrencyList } from "../currency";

export type PromotionItem = {
    id: string;
    label: string;
};

const WhatsNew: (PromotionItem & { action?: () => void })[] = [
    {
        id: "currency-update-v2",
        label: "currency-update-v2-hint",
        action: () => {
            showCurrencyList({ openQuickEntry: true });
        },
    },
    {
        id: "whats-new-1.1",
        label: "whats-new-1.1-promotion-label",
        action: () => {
            window.open(
                "https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/",
                "_blank",
            );
        },
    },
];

export const addPromotion = (item: PromotionItem) => {
    useGuideStore.setState((state) => {
        return {
            ...state,
            dynamicPromotionIds: Array.from(
                new Set([item.id, ...(state.dynamicPromotionIds ?? [])]),
            ),
        };
    });
};

/** 记账后推荐制定预算 */
const BudgetPromotionItem = {
    id: "budget-promotion",
    label: "budget-promotion-label",
    action: () => {
        showBudget();
    },
};

const AllPromotions = [BudgetPromotionItem, ...WhatsNew];

export const afterAddBillPromotion = async () => {
    const isClosed = useGuideStore
        .getState()
        .closedPromotionIds?.includes(BudgetPromotionItem.id);
    if (isClosed) {
        return;
    }
    const budgets = useLedgerStore.getState().infos?.meta.budgets;
    if ((budgets?.length ?? 0) >= 1) {
        return;
    }
    setTimeout(() => {
        addPromotion(BudgetPromotionItem);
    }, 2000);
};

export function Promotion() {
    const t = useIntl();

    const [dynamicPromotionIds, closed] = useGuideStore(
        useShallow((state) => [
            state.dynamicPromotionIds,
            state.closedPromotionIds,
        ]),
    );
    const allPromotions = [
        ...(dynamicPromotionIds?.map((p) =>
            AllPromotions.find((v) => v.id === p),
        ) ?? []),
        WhatsNew[0],
    ].filter((v) => v !== undefined);

    const promotions = allPromotions.filter((v) => !closed?.includes(v.id));

    const closePromotion = (id: string) => {
        useGuideStore.setState((state) => {
            return {
                ...state,
                dynamicPromotionIds: state.dynamicPromotionIds?.filter(
                    (v) => v !== id,
                ),
                closedPromotionIds: Array.from(
                    new Set([...(state.closedPromotionIds ?? []), id]),
                ),
            };
        });
    };

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl || promotions.length === 0) {
            return;
        }
        scrollEl.scrollLeft = 0;
    }, [promotions.length]);

    if (promotions.length === 0) {
        return null;
    }
    return (
        <div className="w-full flex flex-col gap-1">
            <div
                ref={scrollRef}
                className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x scroll-smooth"
            >
                {promotions.map((item, index) => (
                    <div
                        key={item.id}
                        className="relative cursor-pointer flex-shrink-0 snap-start rounded-lg border flex items-center justify-between w-full p-2 h-12"
                        onClick={() => {
                            item?.action?.();
                            setTimeout(() => {
                                closePromotion(item.id);
                            }, 1000);
                        }}
                    >
                        <div
                            className="text-sm"
                            dangerouslySetInnerHTML={{ __html: t(item.label) }}
                        ></div>
                        <button
                            type="button"
                            className="absolute top-1 right-1 cursor-pointer flex w-4 h-4"
                            onClick={(e) => {
                                closePromotion(item.id);
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <i className="icon-[mdi--close-circle]"></i>
                        </button>
                        <div className="absolute bottom-1 right-1 text-xs opacity-60">
                            {index + 1}/{promotions.length}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
