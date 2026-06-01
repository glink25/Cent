import { z } from "zod";
import type { Skill, Tool } from "@/assistant";

function toJsonSchemaSafe(schema: unknown): unknown {
    try {
        // zod v4 exposes z.toJSONSchema for ZodType instances
        return (
            z as unknown as { toJSONSchema: (s: unknown) => unknown }
        ).toJSONSchema(schema as never);
    } catch {
        return null;
    }
}

export function buildToolList(tools: Tool[], skills: Skill[] = []) {
    return {
        tools: tools.map((t) => ({
            name: t.name,
            describe: t.describe,
            argSchema: t.argSchema ? toJsonSchemaSafe(t.argSchema) : null,
            returnSchema: t.returnSchema
                ? toJsonSchemaSafe(t.returnSchema)
                : null,
        })),
        skills: skills.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
        })),
    };
}

export type SkillContext = {
    url: string;
    token: string;
};

export function buildSkillMarkdown(
    tools: Tool[],
    ctx: SkillContext,
    skills: Skill[] = [],
): string {
    const { url, token } = ctx;
    const parts: string[] = [
        "# Cent App Agent 操作手册 Skill",
        "",
        "本手册描述了本地记账应用 Cent 对外提供的一组 HTTP 接口，外部 AI Agent 可以据此协助用户完成账本查询、分析等各类操作（后续会持续扩展更多能力）。",
        "",
        "## 连接信息",
        "",
        "请将以下连接信息保存在 skill 中，后续每次调用都需要使用：",
        "",
        `- **服务地址 (Base URL)**：\`${url}\``,
        `- **访问 Token**：\`${token}\``,
        "- **鉴权方式**：所有请求需带 Header `Authorization: Bearer <Token>`",
        "",
        "Token 并非高敏感密钥，可保存在 skill 文档中以便下次会话沿用；若用户在 app 中重新生成 Token，请重新获取本 skill 更新即可。",
        "",
        "> ⚠️ **前置条件**：上述接口由 Cent 桌面端在本地启动，**只有当 Cent 应用处于打开（运行）状态时才可访问**。若请求超时或连接被拒绝，请提示用户先打开 Cent 并确认已在「设置 → Agent API」中启用该功能。",
        "",
        "## 调用约定",
        "",
        `- 工具调用：\`POST ${url}/tools/<tool_name>\``,
        '- 请求体：`{ "args": <符合 argSchema 的对象> }`；无参工具可省略或传 `{}`。',
        '- 成功响应：`{ "ok": true, "data": <符合 returnSchema 的对象> }`。',
        '- 失败响应：`{ "ok": false, "error": "..." }`。',
        `- 也可通过 \`GET ${url}/tools\` 获取机器可读的工具列表（含 JSON Schema）。`,
        "",
        "## 调用示例",
        "",
        "```bash",
        `curl -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \\`,
        `  -d '{"args": {}}' ${url}/tools/getAccountMeta`,
        "```",
        "",
        "## 可用工具",
        "",
    ];
    for (const t of tools) {
        parts.push(`### \`${t.name}\``, "", t.describe || "_无描述_", "");
        const argJson = t.argSchema ? toJsonSchemaSafe(t.argSchema) : null;
        if (argJson) {
            parts.push(
                "**参数 (JSON Schema)**:",
                "",
                "```json",
                JSON.stringify(argJson, null, 2),
                "```",
                "",
            );
        } else {
            parts.push("_此工具无参数。_", "");
        }
        const retJson = t.returnSchema
            ? toJsonSchemaSafe(t.returnSchema)
            : null;
        if (retJson) {
            parts.push(
                "**返回 (JSON Schema)**:",
                "",
                "```json",
                JSON.stringify(retJson, null, 2),
                "```",
                "",
            );
        }
    }
    if (skills.length) {
        parts.push("## 可用 Skills", "");
        parts.push(
            "以下 skill 文档提供了某些工具的使用上下文/规范，请在调用相关工具前先阅读对应 skill：",
            "",
        );
        for (const s of skills) {
            parts.push(
                `### ${s.name}`,
                "",
                s.description || "_无描述_",
                "",
                s.content,
                "",
            );
        }
    }
    return parts.join("\n");
}
