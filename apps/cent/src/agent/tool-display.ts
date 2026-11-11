import type { Tool } from "@/assistant";

const labels: Record<string, [string, string]> = {
    query: ["查询账单", "icon-[mdi--magnify]"],
    aggregate: ["统计账单", "icon-[mdi--chart-bar]"],
    metadata: ["读取账本配置", "icon-[mdi--book-open-outline]"],
    getEnv: ["读取当前页面", "icon-[mdi--monitor]"],
    widgets: ["读取小组件", "icon-[mdi--widgets-outline]"],
    validateWidget: ["预览小组件", "icon-[mdi--play-circle-outline]"],
    modifyWidget: ["修改小组件", "icon-[mdi--file-edit-outline]"],
    importBills: ["添加账单", "icon-[mdi--plus-box-outline]"],
    modifyBills: ["修改账单", "icon-[mdi--file-edit-outline]"],
    editLedgerMetadata: ["修改账本配置", "icon-[mdi--book-edit-outline]"],
    playground: ["运行代码", "icon-[mdi--console]"],
    discover: ["查找可用工具", "icon-[mdi--magnify]"],
};

export function withToolDisplay(tool: Tool): Tool {
    const display = labels[tool.name];
    if (!display) return tool;
    return {
        ...tool,
        display: {
            label: display[0],
            icon: display[1],
            summarize(params) {
                if (!params || typeof params !== "object") return "";
                const arg = params as Record<string, unknown>;
                if (Array.isArray(arg.items))
                    return `${arg.items.length} 条账单`;
                if (Array.isArray(arg.ids)) return `${arg.ids.length} 条账单`;
                if (arg.resource) return String(arg.resource);
                if (arg.id) return String(arg.id);
                if (arg.filter) return JSON.stringify(arg.filter);
                if (typeof arg.code === "string")
                    return arg.code.replace(/\s+/g, " ").slice(0, 100);
                return "";
            },
        },
    };
}
