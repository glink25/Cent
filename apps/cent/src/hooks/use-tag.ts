import { useCallback, useMemo } from "react";
import type { BillTag } from "@/components/bill-tag/type";
import {
    assertEditable,
    type EffectiveEntry,
} from "@/components/widget/core/computed";
import type { BillTagGroup } from "@/ledger/type";
import { groupTags } from "@/ledger/utils";
import { t } from "@/locale";
import { measure } from "@/measurement";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { useWidgetMeta } from "./use-widget-meta";

export function useTag() {
    const { tags, tagGroups } = useWidgetMeta();

    const updateTag = useCallback(
        (
            id: string,
            newTag: (Omit<BillTag, "id"> & { id?: string }) | undefined,
        ) => {
            assertEditable(id);
            const exists = useLedgerStore
                .getState()
                .infos?.meta.tags?.some((tag) => tag.id === id);
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

    const grouped = useMemo(
        () => groupTags(tags, tagGroups, t("un-grouped")),
        [tags, tagGroups],
    );

    const updateGroup = useCallback(
        (
            id: string,
            newGroup: (Omit<BillTagGroup, "id"> & { id?: string }) | undefined,
        ) => {
            assertEditable(id);
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
        assertEditable(groupId);
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
export type BillTagGroupDetail = EffectiveEntry<BillTagGroup> & {
    tags: EffectiveEntry<BillTag>[];
};
