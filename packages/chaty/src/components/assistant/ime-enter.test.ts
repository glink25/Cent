import { expect, it } from "vitest";
import { decideEnter, type EnterKeyState } from "./ime-enter";

const baseEnter = {
    key: "Enter",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    keyCode: 13,
    isComposing: false,
    composing: false,
    suppressEnter: false,
} satisfies EnterKeyState;

it("sends on plain Enter", () => {
    expect(decideEnter(baseEnter)).toBe("send");
});

it("ignores Enter while composing via composing flag", () => {
    expect(decideEnter({ ...baseEnter, composing: true })).toBe("ignore");
});

it("ignores Enter while isComposing", () => {
    expect(decideEnter({ ...baseEnter, isComposing: true })).toBe("ignore");
});

it("ignores Enter with IME keyCode 229", () => {
    expect(decideEnter({ ...baseEnter, keyCode: 229 })).toBe("ignore");
});

it("suppresses Enter after compositionend", () => {
    expect(decideEnter({ ...baseEnter, suppressEnter: true })).toBe("suppress");
});

it("does not send with Shift/Ctrl/Meta+Enter", () => {
    expect(decideEnter({ ...baseEnter, shiftKey: true })).toBe("none");
    expect(decideEnter({ ...baseEnter, ctrlKey: true })).toBe("none");
    expect(decideEnter({ ...baseEnter, metaKey: true })).toBe("none");
});

it("returns none for non-Enter keys", () => {
    expect(decideEnter({ ...baseEnter, key: "a" })).toBe("none");
});
