import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import type { Widget } from "@/components/widget/type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

export function useWidget() {
    const widgets = useLedgerStore(
        useShallow((state) => state.infos?.meta.widgets ?? []),
    );

    const add = async (
        widget: Omit<Widget, "id" | "createdAt" | "updatedAt">,
    ) => {
        const newWidget: Widget = {
            ...widget,
            id: v4(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: [...(prev.widgets ?? []), newWidget],
        }));

        return newWidget;
    };

    const update = async (
        id: string,
        updates: Partial<Omit<Widget, "id" | "createdAt">>,
    ) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: (prev.widgets ?? []).map((w) =>
                w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w,
            ),
        }));
    };

    const remove = async (id: string) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: (prev.widgets ?? []).filter((w) => w.id !== id),
        }));
    };

    const reorder = async (orderedIds: string[]) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            const widgetMap = new Map(
                (prev.widgets ?? []).map((w) => [w.id, w]),
            );

            // 根据传入的 ID 顺序重新排序
            const reordered = orderedIds
                .map((id) => widgetMap.get(id))
                .filter((w): w is Widget => w !== undefined);

            return {
                ...prev,
                widgets: reordered,
            };
        });
    };

    const get = (id: string) => widgets.find((w) => w.id === id);

    const { id: userId } = useUserStore();
    const homeWidgets = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[userId];
            return (
                widgets?.filter((widget) =>
                    personal?.homeWidgets?.includes(widget.id),
                ) ?? []
            );
        }),
    );

    const toggleHomeWidget = async (widgetId: string) => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            return {
                ...prev,
                homeWidgets: prev.homeWidgets?.includes(widgetId)
                    ? prev.homeWidgets.filter((id) => id !== widgetId)
                    : [...(prev.homeWidgets ?? []), widgetId],
            };
        });
    };

    return {
        widgets,
        add,
        update,
        remove,
        reorder,
        get,
        homeWidgets,
        toggleHomeWidget,
    };
}
