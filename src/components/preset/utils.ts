import { cloneDeep } from "lodash-es";
import type { BillFilterView } from "@/ledger/extra-type";
import type {
    BillCategory,
    BillTag,
    BillTagGroup,
    GlobalMeta,
} from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { version } from "~build/package";
import {
    PRESET_MERGE_RISK,
    type PresetConfig,
    type PresetExportSection,
    type PresetMergeRisk,
} from "./type";

function jsonEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function hasTagLikeOverlap<T extends { id: string; name: string }>(
    oldList: T[],
    newList: T[],
): boolean {
    for (const n of newList) {
        for (const o of oldList) {
            if (o.name === n.name || o.id === n.id) {
                return true;
            }
        }
    }
    return false;
}

function mergeByNameOrId<T extends { id: string; name: string }>(
    oldList: T[],
    incoming: T[],
): T[] {
    const result = [...oldList];
    for (const item of incoming) {
        const nameIdx = result.findIndex((x) => x.name === item.name);
        const idIdx = result.findIndex((x) => x.id === item.id);
        if (nameIdx >= 0) {
            const old = result[nameIdx];
            if (old) {
                result[nameIdx] = { ...item, name: old.name, id: old.id };
            }
        } else if (idIdx >= 0) {
            result[idIdx] = { ...item };
        } else {
            result.push({ ...item });
        }
    }
    return result;
}

export function mergeBillTags(
    oldList: BillTag[],
    incoming: BillTag[],
): BillTag[] {
    return mergeByNameOrId(oldList, incoming);
}

export function mergeBillTagGroups(
    oldList: BillTagGroup[],
    incoming: BillTagGroup[],
): BillTagGroup[] {
    return mergeByNameOrId(oldList, incoming);
}

export function mergeBillCategories(
    oldList: BillCategory[],
    incoming: BillCategory[],
): BillCategory[] {
    return mergeByNameOrId(oldList, incoming);
}

export function mergeBillCustomFilters(
    oldList: BillFilterView[],
    incoming: BillFilterView[],
): BillFilterView[] {
    return mergeByNameOrId(oldList, incoming);
}

function appendOverlapMergeRisk<T extends { id: string; name: string }>(
    risks: PresetMergeRisk[],
    currentList: T[],
    incomingList: T[] | undefined,
    risk: PresetMergeRisk,
): void {
    if (incomingList === undefined) return;
    if (
        !jsonEqual(currentList, incomingList) &&
        hasTagLikeOverlap(currentList, incomingList)
    ) {
        risks.push(risk);
    }
}

export function checkPresetMergeRisk(
    incoming: PresetConfig,
    current: PresetConfig,
): PresetMergeRisk[] {
    const risks: PresetMergeRisk[] = [];

    appendOverlapMergeRisk(
        risks,
        current.tag?.tags ?? [],
        incoming.tag?.tags,
        PRESET_MERGE_RISK.TAGS_WOULD_CHANGE,
    );
    appendOverlapMergeRisk(
        risks,
        current.tag?.groups ?? [],
        incoming.tag?.groups,
        PRESET_MERGE_RISK.TAG_GROUPS_WOULD_CHANGE,
    );
    appendOverlapMergeRisk(
        risks,
        current.category ?? [],
        incoming.category,
        PRESET_MERGE_RISK.CATEGORY_WOULD_CHANGE,
    );
    appendOverlapMergeRisk(
        risks,
        current.customFilters ?? [],
        incoming.customFilters,
        PRESET_MERGE_RISK.FILTERS_WOULD_CHANGE,
    );

    if (incoming.customCSS !== undefined) {
        const a = String(current.customCSS ?? "");
        const b = String(incoming.customCSS ?? "");
        if (a !== b) {
            risks.push(PRESET_MERGE_RISK.CSS_WOULD_CHANGE);
        }
    }

    return risks;
}

export function pickPresetForExport(
    full: PresetConfig,
    sections: PresetExportSection[],
): PresetConfig {
    const out: PresetConfig = {};
    if (sections.includes("tags")) {
        out.tag = {
            tags: full.tag?.tags,
            groups: full.tag?.groups,
        };
    }
    if (sections.includes("categories")) {
        out.category = full.category;
    }
    if (sections.includes("customFilters")) {
        out.customFilters = full.customFilters;
    }
    if (sections.includes("customCSS")) {
        out.customCSS = full.customCSS;
    }
    return out;
}

export function stringifyPresetFile(config: PresetConfig): string {
    return JSON.stringify(
        { format: "cent-preset", centVersion: version, config },
        null,
        2,
    );
}

export function parsePresetFileJson(text: string): PresetConfig {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object") {
        throw new Error("invalid preset file");
    }
    const o = raw as Record<string, unknown>;
    if (
        o.format === "cent-preset" &&
        o.config &&
        typeof o.config === "object"
    ) {
        return o.config as PresetConfig;
    }
    const { format: _f, version: _v, ...rest } = o;
    return rest as PresetConfig;
}

export function exportPresetWith(sections: PresetExportSection[]): string {
    const full = getCurrentPreset();
    const payload = pickPresetForExport(full, sections);
    return stringifyPresetFile(payload);
}

export function getCurrentPreset(): PresetConfig {
    const userId = useUserStore.getState().id;
    const state = useLedgerStore.getState();
    const customCSS = state.infos?.meta.personal?.[userId]?.customCSS;
    const tags = state.infos?.meta.tags;
    const tagGroups = state.infos?.meta.personal?.[userId]?.tagGroups;
    const category = state.infos?.meta.categories;
    const customFilters = state.infos?.meta.customFilters;
    return {
        customCSS,
        tag: {
            tags,
            groups: tagGroups,
        },
        category,
        customFilters,
    };
}

export async function applyPreset(preset: PresetConfig): Promise<void> {
    const userId = useUserStore.getState().id;
    const incTags = preset.tag?.tags;
    const incGroups = preset.tag?.groups;
    const incCategories = preset.category;
    const incFilters = preset.customFilters;
    const incCSS = preset.customCSS;

    const hasMetaChange =
        (incTags !== undefined && incTags.length > 0) ||
        (incGroups !== undefined && incGroups.length > 0) ||
        (incCategories !== undefined && incCategories.length > 0) ||
        (incFilters !== undefined && incFilters.length > 0) ||
        (incCSS !== undefined && incCSS.length > 0);

    if (hasMetaChange) {
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            const next: GlobalMeta = cloneDeep(prev);

            if (incTags !== undefined && incTags.length > 0) {
                next.tags = mergeBillTags(prev.tags ?? [], incTags);
            }
            if (incCategories !== undefined && incCategories.length > 0) {
                next.categories = mergeBillCategories(
                    prev.categories ?? [],
                    incCategories,
                );
            }
            if (incFilters !== undefined && incFilters.length > 0) {
                next.customFilters = mergeBillCustomFilters(
                    prev.customFilters ?? [],
                    incFilters,
                );
            }

            const personalNeedsUpdate =
                (incGroups !== undefined && incGroups.length > 0) ||
                (incCSS !== undefined && incCSS.length > 0);
            if (personalNeedsUpdate) {
                const personal = prev.personal?.[userId] ?? {};
                const updatedPersonal = { ...personal };
                if (incGroups !== undefined && incGroups.length > 0) {
                    updatedPersonal.tagGroups = mergeBillTagGroups(
                        personal.tagGroups ?? [],
                        incGroups,
                    );
                }
                if (incCSS !== undefined && incCSS.length > 0) {
                    updatedPersonal.customCSS = `${personal.customCSS ?? ""}\n${incCSS ?? ""}`;
                }
                next.personal = {
                    ...prev.personal,
                    [userId]: updatedPersonal,
                };
            }

            return next;
        });
    }
    await useLedgerStore.getState().refreshBillList();
}
