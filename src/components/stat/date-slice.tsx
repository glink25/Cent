import dayjs, { type Dayjs } from "dayjs";
import { type ReactNode, useMemo, useState } from "react";
import { DateInput } from "@/components/bill-filter/form";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "../ui/button";

type DateSliceId = string; // weekly|YYYY

export type DateSlicedProps = {
    value?: DateSliceId;
    viewSlices: Record<ViewType, DateSlice[]>;
    onValueChange?: (value?: DateSliceId) => void;
    custom?: [number | undefined, number | undefined];
    onCustomValueChange?: (
        value: [number | undefined, number | undefined],
    ) => void;
    onClickSettings?: () => void;
    children?: ReactNode;
};

const StaticViews = [
    // { id: "daily", label: "stat-view-daily" },
    { id: "weekly", label: "stat-view-weekly" },
    { id: "monthly", label: "stat-view-monthly" },
    { id: "yearly", label: "stat-view-yearly" },
    { id: "custom", label: "stat-view-custom" },
] as const;

type ViewType = (typeof StaticViews)[number]["id"];

type DateSlice = {
    end: Dayjs;
    start: Dayjs;
    label: string;
};
function calcDateSlice(
    range: [number, number],
    viewType: "weekly" | "monthly" | "yearly",
    t: ReturnType<typeof useIntl>,
) {
    const START = dayjs.unix(range[0] / 1000);
    const END = dayjs.unix(range[1] / 1000);

    const labels = (() => {
        if (viewType === "weekly") {
            return {
                unit: "week",
                labelThis: t("this-week"),
                labelLast: t("last-week"),
                format: "MM-DD",
                max: 4,
            } as const;
        }
        if (viewType === "monthly") {
            return {
                unit: "month",
                labelThis: t("this-month"),
                labelLast: t("last-month"),
                format: "YYYY-MM",
            } as const;
        }
        if (viewType === "yearly") {
            return {
                unit: "year",
                labelThis: t("this-year"),
                labelLast: t("last-year"),
                format: "YYYY",
            } as const;
        }
    })();
    if (labels === undefined) {
        return [];
    }
    const { unit, labelThis, labelLast, format, max } = labels;
    let end = END;
    let start = end.startOf(unit);
    const s: DateSlice[] = [];
    s.push({
        label: labelThis,
        end: end,
        start: start,
    });

    let i = 0;
    while (true && i < (max ?? Infinity)) {
        i += 1;
        end = start;
        start = end.subtract(1, unit);
        if (end.isAfter(START)) {
            s.push({
                end,
                start,
                label: i === 1 ? labelLast : start.format(format),
            });
        } else {
            break;
        }
    }
    return s;
}

export function DateSliced({
    value,
    viewSlices,
    custom,
    onValueChange,
    onCustomValueChange,
    children,
    onClickSettings,
}: DateSlicedProps) {
    const t = useIntl();
    const selectedViewId =
        StaticViews.find((v) => value?.startsWith(v.id))?.id ?? "custom";

    const slices =
        selectedViewId === undefined || selectedViewId === "custom"
            ? undefined
            : viewSlices[selectedViewId];

    const selectedSlice = value?.split("|")?.[1];
    return (
        <div className="w-full flex flex-col gap-2">
            <div className="w-full flex">
                <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                    {StaticViews.map((view) => (
                        <Button
                            key={view.id}
                            size={"sm"}
                            className={cn(
                                selectedViewId !== view.id && "text-primary/50",
                            )}
                            variant={
                                selectedViewId === view.id ? "default" : "ghost"
                            }
                            onClick={() => {
                                if (view.id === "custom") {
                                    onValueChange?.();
                                    return;
                                }
                                onValueChange?.(
                                    `${view.id}|${viewSlices[view.id][0].label}`,
                                );
                            }}
                        >
                            {t(view.label)}
                        </Button>
                    ))}
                </div>

                <div className="h-9">
                    {onClickSettings && (
                        <Button
                            variant="ghost"
                            onClick={onClickSettings}
                            className="text-primary/50"
                        >
                            <i className="icon-[mdi--mixer-settings] size-4"></i>
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex gap-2 items-center h-9">
                {slices && slices.length > 0 ? (
                    <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                        {slices.map((slice) => (
                            <Button
                                key={slice.label}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "text-primary/40 px-2",
                                    selectedSlice === slice.label &&
                                        "text-primary",
                                )}
                                onClick={() => {
                                    onValueChange?.(
                                        `${selectedViewId}|${slice.label}`,
                                    );
                                }}
                            >
                                {slice.label}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center gap-3 text-xs">
                        <DateInput
                            value={custom?.[0]}
                            type="start"
                            onChange={(v) => {
                                onCustomValueChange?.([v, custom?.[1]]);
                            }}
                        ></DateInput>
                        <div>-</div>
                        <DateInput
                            value={custom?.[1]}
                            type="end"
                            onChange={(v) => {
                                onCustomValueChange?.([custom?.[0], v]);
                            }}
                        ></DateInput>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

export function useDateSliced({
    range,
    selectCustomSliceWhenInitial,
}: {
    range: [number, number];
    selectCustomSliceWhenInitial?: boolean;
}) {
    const t = useIntl();
    const viewSlices = useMemo(
        () =>
            Object.fromEntries(
                StaticViews.map(({ id: viewType }) => {
                    return viewType === "custom"
                        ? undefined
                        : [viewType, calcDateSlice(range, viewType, t)];
                }).filter((v) => v !== undefined),
            ) as Record<ViewType, DateSlice[]>,
        [range, t],
    );

    const [sliceId, setSliceId] = useState<string | undefined>(
        selectCustomSliceWhenInitial
            ? undefined
            : `monthly|${viewSlices.monthly[0].label}`,
    );

    const [customRange, setCustomRange] =
        useState<[number | undefined, number | undefined]>();

    const props: DateSlicedProps = {
        viewSlices,
        value: sliceId,
        onValueChange: setSliceId,
        custom: customRange,
        onCustomValueChange: setCustomRange,
    };

    const viewType = sliceId
        ? (StaticViews.find((v) => sliceId.startsWith(v.id))?.id ?? "custom")
        : "custom";

    const sliceRange = (() => {
        if (sliceId === undefined) {
            return customRange;
        }
        const slice = viewSlices[viewType].find((v) =>
            sliceId.endsWith(v.label),
        );
        if (slice === undefined) {
            return customRange;
        }
        return [slice.start.unix() * 1000, slice.end.unix() * 1000] as [
            number,
            number,
        ];
    })();
    return { sliceRange, viewType, props, setSliceId };
}
