import type { AnalysisResult } from "@/api/storage/analysis";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import Money from "../money";
import type { FocusType } from "./focus-type";

export function AnalysisDetail({
    analysis,
    type,
    unit,
}: {
    analysis: AnalysisResult;
    type: FocusType;
    unit?: "week" | "month" | "year" | "day";
}) {
    const t = useIntl();

    // 1. 准备所有需要格式化和插入到文案中的动态值
    const formattedValues = {
        dayAvg: (
            <span data-state="value" data-type="day">
                <Money value={amountToNumber(analysis.current.dayAvg)} />
            </span>
        ),
        weekAvg: (
            <span data-state="value" data-type="week">
                <Money value={amountToNumber(analysis.current.weekAvg)} />
            </span>
        ),
        monthAvg: (
            <span data-state="value" data-type="month">
                <Money value={amountToNumber(analysis.current.monthAvg)} />
            </span>
        ),
        yearAvg: (
            <span data-state="value" data-type="year">
                <Money value={amountToNumber(analysis.current.yearAvg)} />
            </span>
        ),
        projectedTotal: (
            <span data-state="value" data-type="predict">
                <Money value={amountToNumber(analysis.projected.total)} />
            </span>
        ),
    };

    // 2. 将对比文案也变成一个独立的、可翻译的部分
    const previousChange =
        analysis.previous.total === 0
            ? 0
            : (analysis.current.total - analysis.previous.total) /
              analysis.previous.total;
    const lastYearChange =
        analysis.lastYear.total === 0
            ? 0
            : (analysis.current.total - analysis.lastYear.total) /
              analysis.lastYear.total;

    // 辅助函数，用于获取增长/减少的文案片段
    const getGrowthMessage = (changeValue: number) => {
        const percentage = (Math.abs(changeValue) * 100).toFixed(2);
        // 根据数值正负选择不同的翻译ID
        const messageId =
            changeValue >= 0
                ? "analysis.growth.positive"
                : "analysis.growth.negative";
        // 使用 intl.formatMessage 生成文案片段
        return (
            <span
                className={
                    changeValue >= 0
                        ? "text-semantic-expense"
                        : "text-semantic-income"
                }
            >
                {t(messageId, { p: percentage })}
            </span>
        );
    };

    // 3. 将对比部分的完整句子也抽象成一个翻译ID
    // 当 unit 为 'day' 时，可能没有“上一周期”的概念，可以不显示
    const ComparisonSection =
        unit !== "day" ? (
            <div className="compare text-xs">
                {t("analysis.comparison.full", {
                    // `lastPeriod` 也从语言包获取
                    lastPeriod: t(`period.${unit}`),
                    // 将生成的文案片段作为值传入
                    changeSinceLastPeriod: getGrowthMessage(previousChange),
                    changeSinceLastYear: getGrowthMessage(lastYearChange),
                })}
            </div>
        ) : null;
    return (
        <>
            <div
                className={cn(
                    "common text-sm [&_[data-state=value]]:font-medium pb-2",
                    type === "expense"
                        ? "[&_[data-state=value]]:text-semantic-income"
                        : type === "income"
                          ? "[&_[data-state=value]]:text-semantic-expense"
                          : "",
                )}
            >
                {t(`analysis.summary.${type}.${unit}`, formattedValues)}
            </div>
            {ComparisonSection}
        </>
    );
}
