import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import type { BillTag } from "@/components/bill-tag/type";
import type { BillTagGroup } from "@/ledger/type";
import { t } from "@/locale";
import { measure } from "@/measurement";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

export function useTag() {
    const [tags = [], tagGroups = []] = useLedgerStore(
        useShallow((state) => {
            const userId = useUserStore.getState().id;
            return [
                state.infos?.meta.tags,
                state.infos?.meta.personal?.[userId]?.tagGroups,
            ];
        }),
    );

    const updateTag = useCallback(
        (
            id: string,
            newTag: (Omit<BillTag, "id"> & { id?: string }) | undefined,
        ) => {
            const exists = useLedgerStore
                .getState()
                .infos?.meta.tags.some((tag) => tag.id === id);
            const result = useLedgerStore
                .getState()
                .updateGlobalMeta((prev) => {
                    if (newTag === undefined) {
                        prev.tags = prev.tags.filter((v) => v.id !== id);
                        return prev;
                    }
                    const index =
                        prev.tags?.findIndex((v) => v.id === id) ?? -1;
                    if (index === -1) {
                        return {
                            ...prev,
                            tags: [
                                ...(prev.tags ?? []),
                                {
                                    ...newTag,
                                    id,
                                },
                            ],
                        };
                    }
                    prev.tags[index] = { ...newTag, id };
                    return prev;
                });
            void result.then(
                () =>
                    measure("feature_config_changed", {
                        feature: "tag",
                        action:
                            newTag === undefined
                                ? "delete"
                                : exists
                                  ? "update"
                                  : "create",
                    }),
                () => undefined,
            );
            return result;
        },
        [],
    );

    const grouped = useMemo(() => {
        const group = tagGroups.map((group) => {
            return {
                ...group,
                tags: (
                    group.tagIds?.map((tid) =>
                        tags.find((v) => v.id === tid),
                    ) ?? []
                ).filter((v) => v !== undefined),
            };
        });
        const unGroup = tags.filter((v) =>
            tagGroups.every((g) => !g.tagIds?.includes(v.id)),
        );
        return [
            ...group,
            {
                name: t("un-grouped"),
                id: "un-group",
                tags: unGroup,
                color: "gray",
                tagIds: unGroup.map((v) => v.id),
            },
        ];
    }, [tagGroups, tags]);

    const updateGroup = useCallback(
        (
            id: string,
            newGroup: (Omit<BillTagGroup, "id"> & { id?: string }) | undefined,
        ) => {
            const userId = useUserStore.getState().id;
            const exists = useLedgerStore
                .getState()
                .infos?.meta.personal?.[userId]?.tagGroups?.some(
                    (group) => group.id === id,
                );
            const result = useLedgerStore
                .getState()
                .updatePersonalMeta((prev) => {
                    if (newGroup === undefined) {
                        prev.tagGroups = prev.tagGroups?.filter(
                            (v) => v.id !== id,
                        );
                        return prev;
                    }
                    const index =
                        prev.tagGroups?.findIndex((v) => v.id === id) ?? -1;
                    if (index === -1) {
                        return {
                            ...prev,
                            tagGroups: [
                                ...(prev.tagGroups ?? []),
                                {
                                    ...newGroup,
                                    id,
                                },
                            ],
                        };
                    }
                    const newGroups = prev.tagGroups ?? [];
                    newGroups[index] = { ...newGroup, id };
                    return prev;
                });
            void result.then(
                () =>
                    measure("feature_config_changed", {
                        feature: "tag_group",
                        action:
                            newGroup === undefined
                                ? "delete"
                                : exists
                                  ? "update"
                                  : "create",
                    }),
                () => undefined,
            );
            return result;
        },
        [],
    );

    const topUpGroup = useCallback((groupId: string) => {
        return useLedgerStore.getState().updatePersonalMeta((prev) => {
            const target = prev.tagGroups?.find((v) => v.id === groupId);
            if (!target) {
                return prev;
            }
            const newGroups = [
                target,
                ...(prev.tagGroups?.filter((v) => v.id !== groupId) ?? []),
            ];
            return { ...prev, tagGroups: newGroups };
        });
    }, []);

    return {
        tags,
        updateTag,
        grouped,
        updateGroup,
        topUpGroup,
    };
}
export type BillTagGroupDetail = BillTagGroup & { tags: BillTag[] };
