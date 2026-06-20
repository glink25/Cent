import type { Provider, SkillInput, Tool } from "../../assistant";

/** UI 可选择的模型 / 配置项（仅展示用，真正的请求参数由 provider 解析）。 */
export type AIChatConfig = {
    id: string;
    name: string;
};

/** 首页快捷提问。 */
export type AIChatPresetPrompt = {
    id: string;
    label: string;
    prompt: string;
};

export type AIChatLocale = "zh" | "en";
export type AIChatTheme = "light" | "dark" | "system";

/**
 * 驱动整个对话 UI 的运行时配置。UI 组件（MainAssistant）完全由该 prop 决定，
 * 与任何宿主领域逻辑解耦：宿主只需构造一个 RuntimeConfig 注入即可。
 */
export type RuntimeConfig = {
    /** 聊天记录隔离域。未传时使用独立的默认域。 */
    scope?: string;
    provider: Provider;
    tools: Tool[];
    skills: SkillInput[];
    systemPrompt?: string;
    configs: AIChatConfig[];
    defaultConfigId?: string;
    presetPrompts?: AIChatPresetPrompt[];
    locale?: AIChatLocale;
    theme?: AIChatTheme;
    title?: string;
    emptyStateSlogan?: string;
};
