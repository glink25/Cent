import { orderBy, sortBy } from "lodash-es";
import { Collapsible } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { StorageDeferredAPI } from "@/api/storage";
import BillFilterForm from "@/components/bill-filter";
import Clearable from "@/components/clearable";
import Ledger from "@/components/ledger";
import { Button } from "@/components/ui/button";
import useCategory from "@/hooks/use-category";
import { useCurrency } from "@/hooks/use-currency";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import type { Bill, BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { cn } from "@/utils";

const SORTS = [
    // 最近的在最上面
    {
        by: "time",
        order: "desc",
        icon: "icon-[mdi--sort-clock-ascending-outline]",
        label: "newest",
    },
    // 最早的在最上面
    {
        by: "time",
        order: "asc",
        icon: "icon-[mdi--sort-clock-descending-outline]",
        label: "oldest",
    },
    // 数额最大的在最上面
    {
        by: "amount",
        order: "desc",
        icon: "icon-[mdi--sort-descending]",
        label: "highest-amount",
    },
    // 数额最小的在最上面
    {
        by: "amount",
        order: "asc",
        icon: "icon-[mdi--sort-ascending]",
        label: "lowest-amount",
    },
] as const;

export default function Page() {
    const t = useIntl();

    const { baseCurrency } = useCurrency();
    const { categories } = useCategory();
    const { state } = useLocation();
    const [form, setForm] = useState<BillFilter>(() => {
        const filter = state?.filter as BillFilter;
        if (filter) {
            return {
                baseCurrency: baseCurrency.id,
                ...filter,
                // 如果传入的参数只有父级分类，则需要同时选择子级分类
                categories: categories
                    .filter((c) =>
                        filter.categories?.some(
                            (v) => v === c.id || v === c.parent,
                        ),
                    )
                    .map((c) => c.id),
            };
        }
        return {};
    });
    const [filterOpen, setFilterOpen] = useState(false);

    const toReset = useCallback(() => {
        setForm({});
    }, []);

    const [list, setList] = useState<Bill[]>([]);
    const [searched, setSearched] = useState(false);
    const toSearch = useCallback(async () => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const result = await StorageDeferredAPI.filter(book, form);
        setList(result);
    }, [form]);

    const navigate = useNavigate();
    const { addFilter } = useCustomFilters();
    const toSaveFilter = useCallback(async () => {
        const name = prompt(t("please-enter-a-name-for-current-filter"));
        if (!name) {
            return;
        }
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const id = await addFilter(name, form);
        navigate(`/stat/${id}`);
    }, [addFilter, form, navigate, t]);

    const hasFilter = useRef(Boolean(state?.filter));
    useEffect(() => {
        if (hasFilter.current) {
            // setFilterOpen(true);
            toSearch();
            hasFilter.current = false;
        }
    }, [toSearch]);

    const [sortIndex, setSortIndex] = useState(0);
    const sorted = useMemo(() => {
        const sort = SORTS[sortIndex] ?? SORTS[0];
        return orderBy(list, [sort.by], [sort.order]);
    }, [list, sortIndex]);
    return (
        <div className="w-full h-full p-2 flex justify-center overflow-hidden">
            <div className="h-full w-full px-2 max-w-[600px] flex flex-col">
                <div className="search w-full flex justify-center pt-4">
                    <div className="w-full h-10 shadow-md rounded-sm flex items-center px-4 focus-within:(shadow-lg)">
                        <div className="flex-1">
                            <Clearable
                                visible={Boolean(form.comment?.length)}
                                onClear={() =>
                                    setForm((v) => ({
                                        ...v,
                                        comment: undefined,
                                    }))
                                }
                            >
                                <input
                                    value={form.comment ?? ""}
                                    type="text"
                                    maxLength={50}
                                    className="w-full bg-transparent outline-none"
                                    onChange={(e) => {
                                        setForm((v) => ({
                                            ...v,
                                            comment: e.target.value,
                                        }));
                                    }}
                                />
                            </Clearable>
                        </div>
                        <Button
                            variant="ghost"
                            className="p-3 rounded-md"
                            onClick={() => {
                                toSearch();
                                setTimeout(() => {
                                    setSearched(true);
                                }, 1000);
                            }}
                        >
                            <i className="icon-[mdi--search]"></i>
                        </Button>
                    </div>
                </div>
                <Collapsible.Root
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    className="flex flex-col group pt-3 text-xs md:text-sm font-medium"
                >
                    <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                        <BillFilterForm form={form} setForm={setForm} />
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
                <div className="flex items-center justify-between px-4 text-xs text-foreground/80">
                    <div>{t("total-records", { n: sorted.length })}</div>
                    <div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setSortIndex((v) => {
                                    if (v === SORTS.length - 1) {
                                        return 0;
                                    }
                                    return v + 1;
                                });
                            }}
                        >
                            <i className={cn(SORTS[sortIndex].icon)}></i>
                            {t(SORTS[sortIndex].label)}
                        </Button>
                    </div>
                </div>
                <Ledger bills={sorted} showTime />
            </div>
        </div>
    );
}
