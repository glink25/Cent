import { z } from "zod";
import type { Tool } from "../assistant";

type JsonSchemaObject = Record<string, unknown>;

const EMPTY_OBJECT_SCHEMA: JsonSchemaObject = {
    type: "object",
    properties: {},
};

/**
 * 把工具的 Zod argSchema 转成标准 JSON Schema（用于 OpenAI tools.function.parameters）。
 * 无 argSchema 的工具回退为空对象 schema。
 */
export function toJsonSchema(tool: Tool): JsonSchemaObject {
    if (!tool.argSchema) return { ...EMPTY_OBJECT_SCHEMA };
    return z.toJSONSchema(tool.argSchema) as JsonSchemaObject;
}

// Gemini functionDeclarations 只接受 OpenAPI 子集，下列 JSON Schema 关键字会被拒绝。
const GEMINI_UNSUPPORTED_KEYS = new Set([
    "$schema",
    "$id",
    "$ref",
    "$defs",
    "definitions",
    "additionalProperties",
    "patternProperties",
    "const",
    // zod v4 (draft 2020-12) 会把 .gt/.lt/.multipleOf 编成下列数值校验关键字，
    // 但 Gemini 不认识。exclusiveMinimum/Maximum 会被改写成 minimum/maximum（见下），
    // multipleOf 无对应字段，直接剔除。
    "multipleOf",
]);

function sanitizeForGemini(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sanitizeForGemini);
    }
    if (value && typeof value === "object") {
        const out: JsonSchemaObject = {};
        for (const [key, v] of Object.entries(value)) {
            // 把排他边界近似成 Gemini 支持的包含边界（仅当对应字段尚未存在）。
            // 这些 schema 只是给模型的工具调用提示，丢失「排他」语义可接受。
            if (key === "exclusiveMinimum") {
                if (!("minimum" in value)) out.minimum = v;
                continue;
            }
            if (key === "exclusiveMaximum") {
                if (!("maximum" in value)) out.maximum = v;
                continue;
            }
            if (GEMINI_UNSUPPORTED_KEYS.has(key)) continue;
            out[key] = sanitizeForGemini(v);
        }
        return out;
    }
    return value;
}

/**
 * 在标准 JSON Schema 基础上清洗掉 Gemini 不接受的关键字，得到
 * functionDeclarations.parameters 可用的 schema。
 */
export function toGeminiSchema(tool: Tool): JsonSchemaObject {
    const base = toJsonSchema(tool);
    return sanitizeForGemini(base) as JsonSchemaObject;
}
