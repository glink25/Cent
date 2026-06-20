/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs, { type Dayjs } from "dayjs";
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import type { OutputType } from "@/database/stash";
import type { Bill } from "@/ledger/type";
import { cn } from "@/utils";
import { denseDate } from "@/utils/time";
import { showBillInfo } from "../bill-info";
import { Checkbox } from "../ui/checkbox";
import BillItem from "./item";
import "./style.scss";

function Divider({
    date: day,
    onClick,
}: {
    date: Dayjs;
    onClick?: () => void;
}) {
    return (
        <div
            className={
                "pl-12 pr-4 pt-4 pb-2 text-sm ledger-divider cursor-pointer"
            }
            onClick={onClick}
        >
            {denseDate(day)}
        </div>
    );
}

type LedgerRef = {
    scrollToIndex: (index: number) => void;
};

type LedgerProps = {
    bills: OutputType<Bill>[];
    /** 如果传入的列表已按时间降序，则尝试按照日期分隔 */
    enableDivideAsOrdered?: boolean;
    className?: string;
    showTime?: boolean;
    selectedIds?: string[];
    /** 是否显示列表首次出场动画 */
    presence?: boolean;
    onSelectChange?: (id: string) => void;
    afterEdit?: (bill: Bill) => void;
    onItemShow?: (index: number) => void;
    onVisibleDateChange?: (date: Dayjs) => void;
    onDateClick?: (date: Dayjs) => void;
    showAssets?: boolean;
};

const Ledger = forwardRef<LedgerRef, LedgerProps>(
    (
        {
            bills,
            enableDivideAsOrdered,
            className,
            showTime,
            selectedIds,
            presence,
            onSelectChange,
            afterEdit,
            onItemShow,
            onVisibleDateChange,
            onDateClick,
            showAssets,
        },
        ref,
    ) => {
        const parentRef = useRef<HTMLDivElement>(null);
        const [stickyDate, setStickyDate] = useState<Dayjs | null>(null);

        useImperativeHandle(ref, () => ({
            scrollToIndex: (index: number) => {
                rowVirtualizer.scrollToIndex(index);
            },
        }));

        const rowVirtualizer = useVirtualizer({
            count: bills.length,
            getScrollElement: () => parentRef.current,
            // 使用一个合理的预估高度，这个值可以帮助虚拟化器在初次渲染时计算总高度
            // 它不必须非常精确，但越接近实际平均值，用户体验越好
            estimateSize: () => 60, // 假设一个合理的平均高度
            overscan: 5,
            paddingEnd: 80,
        });

        const enableSelect = selectedIds !== undefined;

        useEffect(() => {
            const el = parentRef.current;
            if (!el) return;
            const handleScroll = () => {
                const scrollTop = el.scrollTop;
                const visibleItems = rowVirtualizer.getVirtualItems();
                // 找到第一个底部超过 scrollTop 的 item，即当前顶部可见的那个
                const firstVisible = visibleItems.find(
                    (item) => item.start + item.size > scrollTop,
                );
                if (firstVisible) {
                    const firstBill = bills[firstVisible.index];
                    const curDate = dayjs.unix(firstBill.time / 1000);
                    onVisibleDateChange?.(curDate);
                    if (enableDivideAsOrdered) {
                        setStickyDate((prev) => {
                            if (prev && curDate.isSame(prev, "day"))
                                return prev;
                            return curDate;
                        });
                    }
                }
            };
            el.addEventListener("scroll", handleScroll, { passive: true });
            // 初始调用
            handleScroll();
            return () => el.removeEventListener("scroll", handleScroll);
        }, [bills, enableDivideAsOrdered, onVisibleDateChange, rowVirtualizer]);

        useEffect(() => {
            if (!presence) {
                return;
            }
            const listEl =
                parentRef.current?.querySelector<HTMLDivElement>(
                    "[data-main-ledger]",
                );
            if (!listEl) {
                return;
            }
            listEl.classList.add("animated-bill-list");
            setTimeout(() => {
                listEl.classList.remove("animated-bill-list");
            }, 1600);
        }, [presence]);

        return (
            <div
                ref={parentRef}
                className={cn("relative bill-list", className)}
                style={{
                    height: `100%`,
                    overflow: "auto",
                }}
            >
                {enableDivideAsOrdered && stickyDate && (
                    <div
                        key={stickyDate.format("YYYY-MM-DD")}
                        className="sticky top-0 z-10 pl-12 pr-4 py-1 text-sm ledger-divider bg-background/80 backdrop-blur-sm cursor-pointer"
                        onClick={() => onDateClick?.(stickyDate)}
                    >
                        {denseDate(stickyDate)}
                    </div>
                )}
                <div
                    data-main-ledger
                    className={cn(
                        enableDivideAsOrdered &&
                            "translate-x-0 before:block before:fixed before:top-0 before:left-9 before:w-[1px] before:h-[calc(100%-95px)] before:bg-foreground",
                    )}
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const bill = bills[virtualRow.index];
                        const curDate = dayjs.unix(bill.time / 1000);
                        const isDivider = !enableDivideAsOrdered
                            ? undefined
                            : (() => {
                                  const lastBill = bills[virtualRow.index + 1];
                                  if (!lastBill) {
                                      return undefined;
                                  }
                                  const lastDate = dayjs.unix(
                                      lastBill.time / 1000,
                                  );
                                  const isSameDay = lastDate.isSame(
                                      curDate,
                                      "days",
                                  );
                                  if (!isSameDay) {
                                      return lastDate;
                                  }
                              })();
                        onItemShow?.(virtualRow.index);
                        return (
                            <div
                                key={virtualRow.key}
                                data-index={virtualRow.index}
                                // 这一行非常关键：将 ref={rowVirtualizer.measureElement}
                                // 传递给每个虚拟行的 DOM 元素
                                ref={rowVirtualizer.measureElement}
                                style={{
                                    position: "absolute",
                                    top: `${virtualRow.start}px`,
                                    left: 0,
                                    width: "100%",
                                }}
                            >
                                <div
                                    className={`w-full flex items-center overflow-hidden ledger-item item-${virtualRow.index}`}
                                    onClick={
                                        enableSelect
                                            ? () => {
                                                  onSelectChange?.(bill.id);
                                              }
                                            : undefined
                                    }
                                >
                                    {enableSelect && (
                                        <Checkbox
                                            checked={selectedIds.includes(
                                                bill.id,
                                            )}
                                        ></Checkbox>
                                    )}
                                    <BillItem
                                        bill={bill}
                                        className="flex-1 overflow-hidden"
                                        onClick={
                                            enableSelect
                                                ? undefined
                                                : async () => {
                                                      await showBillInfo(bill);
                                                      afterEdit?.(bill);
                                                  }
                                        }
                                        showTime={showTime}
                                        showAssets={showAssets}
                                    />
                                </div>
                                {isDivider && (
                                    <Divider
                                        date={isDivider}
                                        onClick={() => onDateClick?.(isDivider)}
                                    />
                                )}
                                {enableDivideAsOrdered &&
                                    virtualRow.index === bills.length - 1 && (
                                        <div className="ledger-end flex items-center py-1 pl-12 text-xs before:absolute before:-translate-x-[15px] before:block before:size-2 before:rounded-full before:border">
                                            The end
                                        </div>
                                    )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    },
);

export default Ledger;
