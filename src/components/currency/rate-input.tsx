import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // 假设你使用的是 shadcn/ui
import { useIntl } from "@/locale";

interface RateInputProps {
    baseCurrencyLabel: string;
    targetCurrencyLabel: string;
    /** 本位币 → 目标币汇率；undefined 表示置空（恢复自动汇率） */
    value: number | undefined;
    onChange: (rate: number | undefined) => void;
    label?: string;
    /** 为 false 时清空输入不会把汇率设为 undefined（用于自定义币种表单） */
    allowClear?: boolean;
}

const RateInput = ({
    baseCurrencyLabel,
    targetCurrencyLabel,
    value,
    onChange,
    allowClear = true,
}: RateInputProps) => {
    const t = useIntl();
    const [isInverted, setIsInverted] = useState(false);
    const [displayValue, setDisplayValue] = useState<string>(
        value != null ? String(value) : "",
    );

    // 当外部 value 改变或切换反转模式时，同步显示数值
    useEffect(() => {
        if (value == null) {
            setDisplayValue("");
            return;
        }
        if (isInverted) {
            // 反转模式显示：1 目标币 = ? 本位币 (即 1/rate)
            const invRate = (1 / value).toFixed(6);
            setDisplayValue(invRate.replace(/\.?0+$/, "")); // 去除多余的0
        } else {
            setDisplayValue(String(value));
        }
    }, [isInverted, value]);

    const handleInputChange = (val: string) => {
        setDisplayValue(val);
        const trimmed = val.trim();
        if (trimmed === "") {
            if (allowClear) {
                onChange(undefined);
            } else if (value != null) {
                setDisplayValue(
                    isInverted
                        ? (1 / value).toFixed(6).replace(/\.?0+$/, "")
                        : String(value),
                );
            }
            return;
        }
        const num = parseFloat(val);
        if (Number.isNaN(num) || num <= 0) return;

        if (isInverted) {
            // 如果是反转模式，传回父组件的值应该是 1 / 输入值
            onChange(1 / num);
        } else {
            onChange(num);
        }
    };

    const toggleInvert = () => {
        setIsInverted(!isInverted);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3 px-1 py-3">
                {/* 左侧文字 */}
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                    1 {isInverted ? targetCurrencyLabel : baseCurrencyLabel} =
                </div>

                {/* 输入框 */}
                <Input
                    type="number"
                    className="flex-1 text-end"
                    value={displayValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="0.00"
                />

                {/* 右侧文字 */}
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {isInverted ? baseCurrencyLabel : targetCurrencyLabel}
                </div>

                {/* 反转切换按钮 */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleInvert}
                    className="ml-auto flex gap-1 items-center"
                    title="切换基准货币"
                >
                    <i className="icon-[mdi--exchange] h-4 w-4" />
                </Button>
            </div>

            {/* 提示信息 */}
            <p className="text-[12px] text-muted-foreground italic">
                * {t("rate-hint")} 1 {baseCurrencyLabel} ={" "}
                {value != null ? value : "—"} {targetCurrencyLabel}
            </p>
        </div>
    );
};

export default RateInput;
