// chaty UI 库入口：仅导出可复用的对话 UI 组件与配套类型，**不引入任何样式**。
// chaty 已是源码消费包（由 cent 直接消费源码），样式由 cent 自身的单份 Tailwind
// 统一生成，绝不能在此 import tailwind-root（否则会在宿主内产生第二个 Tailwind root）。
export {
    I18nProvider,
    type Locale,
    resolveLocale,
    useI18n,
} from "../components/assistant/i18n";
export { default as MainAssistant } from "../components/assistant/main";
export { MessageBubble } from "../components/assistant/message";
export type {
    AIChatConfig,
    AIChatLocale,
    AIChatPresetPrompt,
    AIChatTheme,
    RuntimeConfig,
} from "../components/assistant/runtime";
export {
    type Chat,
    useAssistantChatStore,
} from "../components/assistant/state";
export {
    applyThemePreference,
    type ThemePreference,
} from "../components/assistant/theme";
// 默认工具 / 技能 / 兜底 provider，方便消费方做最小可用接入。
export { AiChatConfig } from "../components/assistant/tools";
