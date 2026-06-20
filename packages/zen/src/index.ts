// 注意：tailwind-root（./index.css）不在此引入，避免被 cent 走源码消费时在宿主内
// 产生第二个 Tailwind root。zen 已是源码消费包，不再发布 npm。
// zen.css 为纯 CSS（主题 token / 动效），cent 需要它，故保留在源码入口。
import "./zen/zen.css";

export type { ZenProps } from "./main";
export { Zen } from "./main";
export { getHostBridge } from "./runtime/host";
export type {
    NativeBridgeMessage,
    NativeCallback,
    ZenAIToolDefinition,
    ZenInitPayload,
    ZenLocale,
    ZenPostMutation,
    ZenRequestHandle,
    ZenRuntimeHost,
    ZenThemeMode,
} from "./runtime/types";
export * from "./zen/date";
export { isZenFallbackDevMode } from "./zen/dev";
export type * from "./zen/types";
