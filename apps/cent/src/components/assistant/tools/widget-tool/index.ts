import { z } from "zod";
import { createTool } from "@/assistant";
import { parseSkillMetadata } from "@/assistant/parser";
import widgetApiDoc from "@/components/widget/core/WIDGET_API.md?raw";
import { showWidgetEdit } from "@/components/widget/edit-form";
import type { Widget } from "@/components/widget/type";
import widgetSkill from "./skill.md?raw";

export const CreateWidgetTool = createTool({
    name: "createWidget",
    describe:
        "创建一个新的 widget 预览。传入符合 widget DSL 规范的代码，弹出 widget 编辑器进行预览与保存。代码必须以 `export default async ({ data, settings, env }) => { ... }` 形式导出，并在文件顶部以注释声明 `@widget-api`、`@name`、`@permissions`。可在 `data` 中读取 billing/budgets/categories/tags 等数据。调用前请先阅读 `widget` skill 了解完整 API。",
    argSchema: z.object({
        code: z
            .string()
            .min(1)
            .describe(
                "Widget 源代码（ES Module 格式），需 default export 一个返回 DSL 节点的 async 函数。",
            ),
    }),
    returnSchema: z.object({
        saved: z.boolean().describe("用户是否保存了 widget"),
        cancelled: z.boolean().describe("用户是否取消"),
    }),
    handler: async (arg: { code: string }) => {
        try {
            await showWidgetEdit({ code: arg.code } as Widget);
            return { saved: true, cancelled: false };
        } catch {
            return { saved: false, cancelled: true };
        }
    },
});

export const CreateWidgetSkill = parseSkillMetadata(
    `${widgetSkill}\n\n${widgetApiDoc}\n`,
);
