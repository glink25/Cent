/** IME / Enter 决策：避免中文输入法用回车上屏时误触发发送。 */

export type EnterDecision = "ignore" | "suppress" | "send" | "none";

export type EnterKeyState = {
    key: string;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    /** KeyboardEvent.keyCode；IME 确认键常为 229。 */
    keyCode: number;
    isComposing: boolean;
    /** compositionstart…compositionend 之间为 true。 */
    composing: boolean;
    /** compositionend（或组合中的 Enter）后短暂置位，吞掉 Chrome 多余的 Enter。 */
    suppressEnter: boolean;
};

/**
 * 纯 Enter（无 Shift/Ctrl/Meta）才参与发送。
 * - ignore：仍在输入法组合中，不 preventDefault，让 IME 完成上屏
 * - suppress：compositionend 后的多余 Enter，需 preventDefault，不发送
 * - send：真正发送
 * - none：非纯 Enter（含修饰键）或其它键
 */
export function decideEnter(state: EnterKeyState): EnterDecision {
    if (state.key !== "Enter") {
        return "none";
    }
    if (state.shiftKey || state.metaKey || state.ctrlKey) {
        return "none";
    }
    if (state.composing || state.isComposing || state.keyCode === 229) {
        return "ignore";
    }
    if (state.suppressEnter) {
        return "suppress";
    }
    return "send";
}
