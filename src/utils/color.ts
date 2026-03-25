export const getCSSVariable = (variable: string) => {
    if (typeof document === "undefined") return "";
    const rootStyle = getComputedStyle(document.body);
    return rootStyle.getPropertyValue(variable).trim();
};

export const createColorSet = (preset: string[]) => {
    const assignedMap = new Map<string, string>();

    // 记录当前分配到第几个“新色”了
    let colorIndex = 0;

    const getColor = (name: string): string => {
        const existing = assignedMap.get(name);
        if (existing !== undefined) return existing;

        let finalColor: string;

        // 1. 优先按顺序取预设
        if (colorIndex < preset.length) {
            finalColor = preset[colorIndex];
        } else {
            // 2. 预设用完，按顺序生成不重复的颜色
            const goldenRatioConjugate = 0.618033988749895;
            // 使用递增的 colorIndex 保证颜色均匀分布
            const hue = (colorIndex * goldenRatioConjugate * 360) % 360;
            finalColor = `hsl(${Math.floor(hue)}, 70%, 60%)`;
        }

        colorIndex++;
        assignedMap.set(name, finalColor);
        return finalColor;
    };

    return getColor;
};

/** 与 `src/index.css` 中系列色一致，仅在无 DOM（如测试）时作回退 */
const CHART_SERIES_FALLBACK = [
    "#5470c6",
    "#91cc75",
    "#fac858",
    "#ee6666",
    "#73c0de",
    "#3ba272",
    "#fc8452",
    "#9a60b4",
    "#ea7ccc",
] as const;

const CATEGORY_COLOR_VARS = [
    "--category-color-1",
    "--category-color-2",
    "--category-color-3",
    "--category-color-4",
    "--category-color-5",
    "--category-color-6",
    "--category-color-7",
    "--category-color-8",
    "--category-color-9",
] as const;

const COLLABORATOR_COLOR_VARS = [
    "--collaborator-color-1",
    "--collaborator-color-2",
    "--collaborator-color-3",
    "--collaborator-color-4",
    "--collaborator-color-5",
    "--collaborator-color-6",
    "--collaborator-color-7",
    "--collaborator-color-8",
    "--collaborator-color-9",
] as const;

const chartPresetFromVarNames = (names: readonly string[]): string[] =>
    names.map((name, i) => {
        const v = getCSSVariable(name);
        if (v) return v;
        const fb = CHART_SERIES_FALLBACK[i];
        return fb !== undefined ? fb : "";
    });

export const categoryColors = createColorSet(
    chartPresetFromVarNames(CATEGORY_COLOR_VARS),
);

export const collaboratorColors = createColorSet(
    chartPresetFromVarNames(COLLABORATOR_COLOR_VARS),
);
