import dayjs, { type Dayjs } from "dayjs";
import { ChevronDownIcon } from "lucide-react";
import type React from "react";
import { type ReactNode, useState } from "react";
import { useIntl } from "@/locale";
import { denseDate } from "@/utils/time";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Props = {
    value?: number;
    formatter?: (time: number) => string;
    displayFormatter?: string | ((time?: Dayjs) => string);
    onChange?: (value: number) => void;
    children?: React.ReactNode;
    onBlur?: () => void;
    type?: "datetime-local" | "date";
};

const Hours = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}`.padStart(2, "0"),
    value: `${i}`,
}));
const Minutes = Array.from({ length: 60 }, (_, i) => ({
    label: `${i}`.padStart(2, "0"),
    value: `${i}`,
}));

function NativeSelect({
    children,
    value,
    options,
    onValueChange,
}: {
    options: { label: string; value: string }[];
    value: string;
    children?: ReactNode;
    onValueChange?: (v: string) => void;
}) {
    return (
        <span className="has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border rdp-dropdown_root">
            <select
                className="bg-popover absolute inset-0 opacity-0 rdp-dropdown rdp-hours_dropdown"
                aria-label="Choose the Hour"
                value={value}
                onChange={(e) => {
                    onValueChange?.(e.currentTarget.value);
                }}
            >
                {options.map((h) => (
                    <option key={h.value} value={h.value}>
                        {h.label}
                    </option>
                ))}
            </select>
            <span
                className="select-none h-(--cell-size) font-medium [&>svg]:text-muted-foreground flex items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5 rdp-caption_label"
                aria-hidden
            >
                {children ?? value}
                <ChevronDownIcon />
            </span>
        </span>
    );
}

export function DatePicker({
    value,
    displayFormatter = (v) => (v ? denseDate(v) : ""),
    onChange,
    children,
    onBlur,
    type = "datetime-local",
}: Props) {
    const t = useIntl();

    const [open, setOpen] = useState(false);

    // display 格式化函数
    const display =
        typeof displayFormatter === "function"
            ? displayFormatter
            : (d?: Dayjs) => d?.format(displayFormatter as string);

    const current = value ? dayjs(value as any) : dayjs();
    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) {
                    onBlur?.();
                }
            }}
        >
            <PopoverTrigger>
                <div className="flex justify-center items-center relative cursor-pointer">
                    {children}
                    <div className="mx-2">
                        {display(value ? current : undefined)}
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto overflow-hidden p-3 flex flex-col gap-2"
                align="center"
                side="bottom"
                sideOffset={-36}
            >
                <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    className="rounded-md p-0"
                    selected={current.toDate()}
                    onSelect={(v) => {
                        if (v) {
                            onChange?.(v.getTime());
                        }
                    }}
                />
                <div className="flex justify-between items-center [--cell-size:--spacing(8)] px-2">
                    <span className="text-sm">{t("time")}</span>
                    <div className="flex gap-2 items-center">
                        <NativeSelect
                            value={current.format("HH")}
                            options={Hours}
                            onValueChange={(v) => {
                                const newValue = current.hour(Number(v));
                                onChange?.(newValue.unix() * 1000);
                            }}
                        />
                        <span>:</span>
                        <NativeSelect
                            value={current.format("mm")}
                            options={Minutes}
                            onValueChange={(v) => {
                                const newValue = current.minute(Number(v));
                                onChange?.(newValue.unix() * 1000);
                            }}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
