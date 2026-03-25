import type { BillFilterView } from "@/ledger/extra-type";
import type { BillCategory, BillTag, BillTagGroup } from "@/ledger/type";

/** 导入预设时可能影响的配置项（与 README 中策略一致） */
export const PRESET_MERGE_RISK = {
    TAGS_WOULD_CHANGE: "TAGS_WOULD_CHANGE",
    TAG_GROUPS_WOULD_CHANGE: "TAG_GROUPS_WOULD_CHANGE",
    CATEGORY_WOULD_CHANGE: "CATEGORY_WOULD_CHANGE",
    FILTERS_WOULD_CHANGE: "FILTERS_WOULD_CHANGE",
    CSS_WOULD_CHANGE: "CSS_WOULD_CHANGE",
} as const;

export type PresetMergeRisk =
    (typeof PRESET_MERGE_RISK)[keyof typeof PRESET_MERGE_RISK];

/** 导出预设时可勾选的区块 */
export type PresetExportSection =
    | "tags"
    | "categories"
    | "customFilters"
    | "customCSS";

export type OnlinePreset = {
    id: string;
    name: string;
    description: string;
    assets: string;
    author: {
        avatar: string;
        name: string;
    };
    url: string;
    config: PresetConfig;
};

export type PresetConfig = {
    customCSS?: string;
    tag?: {
        groups?: BillTagGroup[];
        tags?: BillTag[];
    };
    category?: BillCategory[];
    customFilters?: BillFilterView[];
};
