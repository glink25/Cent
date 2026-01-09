export const getCSSVariable = (variable: string) => {
    const rootStyle = getComputedStyle(document.body);
    const value = rootStyle.getPropertyValue(variable).trim();
    return value;
};

export const createColorSet = (preset: string[]) => {
    const assignedMap = new Map<string, string>();

    // 记录当前分配到第几个“新色”了
    let colorIndex = 0;

    const getColor = (name: string): string => {
        if (assignedMap.has(name)) return assignedMap.get(name)!;

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
// 自动生成category的颜色
export const categoryColors = createColorSet([
    "#5470c6",
    "#91cc75",
    "#fac858",
    "#ee6666",
    "#73c0de",
    "#3ba272",
    "#fc8452",
    "#9a60b4",
    "#ea7ccc",
]);
