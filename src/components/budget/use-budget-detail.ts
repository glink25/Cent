import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import type { Budget } from "./type";
import { budgetRange, budgetTotal } from "./util";

export function useBudgetDetail(budget: Budget) {
    const total = useMemo(() => budgetTotal(budget), [budget]);
    const [allRanges, currentRange] = useMemo(
        () => budgetRange(budget),
        [budget],
    );

    const getTime = useCallback((currentRange: [dayjs.Dayjs, dayjs.Dayjs]) => {
        if (!currentRange) {
            return undefined;
        }
        const now = dayjs();
        const spend = now.diff(currentRange[0]);
        const duration = currentRange[1].diff(currentRange[0]);
        const totalDays = dayjs.duration(duration).asDays();
        const spendDays = dayjs.duration(spend).asDays();
        const leftDays = Math.max(0, totalDays - spendDays);
        return { percent: spend / duration, leftDays, totalDays };
    }, []);
    return {
        total,
        allRanges,
        currentRange,
        getTime,
    };
}
