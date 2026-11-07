import { getAgentTurnSnapshot } from "@/agent/operations";
import { amountToNumber } from "@/ledger/bill";
import { analyzeZenBudgets, getZenCategories } from "./analyzer";
import type { ZenContext, ZenUIStep } from "./types";

export async function resolveZenStepContext(
    step: ZenUIStep,
    context: ZenContext,
    resources: Map<string, unknown>,
): Promise<ZenContext> {
    const ids = {
        bill: new Set<string>(),
        category: new Set<string>(),
        budget: new Set<string>(),
    };
    for (const block of step.content)
        if (block.type === "entityList")
            for (const id of block.ids) ids[block.entityType].add(id);

    const view = {
        ...context,
        candidateBills: [],
        topCategories: [],
        budgets: [],
    };
    if (!ids.bill.size && !ids.category.size && !ids.budget.size) return view;

    // The same snapshot backs both native calls and Playground reads.
    const snapshot = await getAgentTurnSnapshot(resources);
    if (!snapshot) return view;

    const { bills, meta } = snapshot;
    const categories = getZenCategories(meta);
    const names = new Map(categories.map(({ id, name }) => [id, name]));
    const topCategories = new Map<
        string,
        ZenContext["topCategories"][number]
    >();
    const candidateBills: ZenContext["candidateBills"] = [];
    for (const bill of bills) {
        if (bill.time < context.period.start || bill.time > context.period.end)
            continue;
        const name = names.get(bill.categoryId) ?? bill.categoryId;
        const amount = amountToNumber(bill.amount);
        if (ids.bill.has(bill.id))
            candidateBills.push({
                id: bill.id,
                time: bill.time,
                type: bill.type,
                categoryId: bill.categoryId,
                categoryName: name,
                amount,
                comment: bill.comment?.slice(0, 160),
            });
        if (ids.category.has(bill.categoryId)) {
            const category = topCategories.get(bill.categoryId) ?? {
                id: bill.categoryId,
                name,
                type: bill.type,
                amount: 0,
                count: 0,
            };
            category.amount += amount;
            category.count++;
            topCategories.set(category.id, category);
        }
    }
    return {
        ...view,
        summary: { ...context.summary, currency: meta.baseCurrency ?? "CNY" },
        candidateBills,
        topCategories: [...topCategories.values()],
        budgets: ids.budget.size
            ? analyzeZenBudgets(
                  (meta.budgets ?? []).filter((budget) =>
                      ids.budget.has(budget.id),
                  ),
                  bills,
                  context.period,
                  categories,
              )
            : [],
    };
}
