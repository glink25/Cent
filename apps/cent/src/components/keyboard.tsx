// Caculator.tsx

import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "./ui/button";

const charKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
const pointKey = ".";

type Char = (typeof charKeys)[number];
type Operator = "+" | "-" | "x" | "÷";
type Point = typeof pointKey;
type Eq = "=";
type Value = Char | Operator | Point | Eq;

//[ '0','1','2','.','4','5'] -> 012.45
type Num = (Char | Point)[];

//[[ '0','1','2','.','4','5'],"+",['1']] -> 012.45+1
type Formula = [Num] | [Num, Operator] | [Num, Operator, Num];

type CalculatorContextType = {
    handleButtonClick: (value: ButtonValue) => void;
    formula: Formula;
    cursor: number;
    setCursor: (position: number | ((cursor: number) => number)) => void;
    valueRef: React.RefObject<HTMLDivElement | null>;
    Layout: {
        label: string;
        cols: number;
    }[];
};

type ButtonValue = string;
// --- Context ---
const CalculatorContext = createContext<CalculatorContextType | null>(null);

const getLayout = (multiplyKey?: "double-zero" | "triple-zero") => [
    { label: "1", cols: 2 },
    { label: "2", cols: 2 },
    { label: "3", cols: 2 },
    { label: "c", cols: 4 },
    { label: "4", cols: 2 },
    { label: "5", cols: 2 },
    { label: "6", cols: 2 },
    { label: "+", cols: 1 },
    { label: "-", cols: 1 },
    { label: "7", cols: 2 },
    { label: "8", cols: 2 },
    { label: "9", cols: 2 },
    { label: "x", cols: 1 },
    { label: "÷", cols: 1 },
    { label: "r", cols: 2 },
    ...(multiplyKey
        ? [
              { label: "0", cols: 1 },
              { label: multiplyKey === "double-zero" ? "00" : "000", cols: 2 },
              { label: ".", cols: 1 },
          ]
        : [
              { label: "0", cols: 2 },
              { label: ".", cols: 2 },
          ]),

    { label: "=", cols: 4 },
];

const operators = ["+", "-", "x", "÷"];

const isOperator = (v: string): v is Operator => operators.includes(v);

const padZero = (v: (Operator | "." | Char)[]) => {
    if (v[0] === "0" && v.length > 1 && v[1] !== ".") {
        return padZero(v.slice(1));
    }
    return v;
};

const padPrecision = (v: (Operator | "." | Char)[], precision: number) => {
    const index = v.indexOf(".") === -1 ? v.length : v.indexOf(".");
    return v.slice(0, index + precision + 1);
};

const arrayToFormula = (full: (Operator | "." | Char)[], precision: number) => {
    const opIndex = full.findIndex((v, i) => i !== 0 && isOperator(v));
    if (opIndex === -1) {
        return [padPrecision(padZero(full), precision)] as Formula;
    }
    const left = full.slice(0, opIndex);
    const right = full.slice(opIndex + 1);
    return [
        padPrecision(padZero(left), precision),
        full[opIndex],
        padPrecision(padZero(right), precision),
    ].filter((v) => v.length > 0) as Formula;
};

const numToNumber = (num: Num) => {
    if (num.length === 0) {
        return 0;
    }
    return Number(num.join(""));
};

const formulaToNumber = (form: Formula, precision: number) => {
    const [leftNum, op, rightNum] = form;
    const left = numToNumber(leftNum);
    if (op === undefined || rightNum === undefined) {
        return left;
    }
    const right = numToNumber(rightNum);
    const prec = (v: number) => Number(v.toFixed(precision));
    switch (op) {
        case "+":
            return prec(left + right);
        case "-":
            return prec(left - right);
        case "x":
            return prec(left * right);
        case "÷":
            return prec(left / right);
    }
};

const createFormula = (
    _value: string | number,
    precision: number,
    _prev?: Formula,
) => {
    const prev = _prev ?? [["0"]];
    const value = `${_value}` as Value;
    // 1，传入小数点，但上一个数字已经有小数点
    const num = prev[2] ?? prev[0];
    if (value === ".") {
        if (num.includes(".")) {
            return [...prev] as Formula;
        }
        num.push(value);
        return [...prev] as Formula;
    }
    // 2，传入Operator
    if (isOperator(value)) {
        // 如果已经有operator，先计算出结果，再追加
        if (prev[1]) {
            const result = [
                `${formulaToNumber(prev, precision)}`.split(""),
            ] as Formula;
            return createFormula(value, precision, result);
        }
        // 否则直接追加
        prev[1] = value;
        return [...prev] as Formula;
    }
    if (value === "=") {
        return [`${formulaToNumber(prev, precision)}`.split("")] as Formula;
    }

    const full = prev.flat();
    if (full.length > 16) {
        return prev;
    }
    full.push(value);
    return arrayToFormula(full, precision);
};

const toText = (form: Formula) => {
    const [leftNum, op, rightNum] = form;
    return `${leftNum.join("")}${op ?? ""}${rightNum?.join("") ?? ""}`;
};

const numberToFormula = (v: number) => {
    return [`${v}`.split("")] as Formula;
};

const findOpIndex = (full: (Operator | "." | Char)[]) =>
    full.findIndex((v, i) => i !== 0 && isOperator(v));

// 在光标位置插入一个字符，严格遵循 createFormula 的合法性规则。
// 非法输入返回 null（调用方应忽略该按键）。
const insertChar = (
    formula: Formula,
    cursor: number,
    ch: string,
    precision: number,
): { formula: Formula; cursor: number } | null => {
    const full = formula.flat();
    const opIndex = findOpIndex(full);
    if (isOperator(ch)) {
        // 只允许一个运算符，且不能位于最前
        if (cursor === 0 || opIndex !== -1) {
            return null;
        }
    } else if (ch === ".") {
        // 找到光标所属的数字段，若该段已有小数点则忽略
        const inLeft = opIndex === -1 || cursor <= opIndex;
        const segStart = inLeft ? 0 : opIndex + 1;
        const segEnd = inLeft
            ? opIndex === -1
                ? full.length
                : opIndex
            : full.length;
        if (full.slice(segStart, segEnd).includes(".")) {
            return null;
        }
    } else {
        // 数字，长度上限与 createFormula 保持一致
        if (full.length > 16) {
            return null;
        }
    }
    const candidate = [
        ...full.slice(0, cursor),
        ch as Operator | "." | Char,
        ...full.slice(cursor),
    ];
    const newFormula = arrayToFormula(candidate, precision);
    return {
        formula: newFormula,
        cursor: Math.min(cursor + 1, toText(newFormula).length),
    };
};

// 删除指定字符，并保留该位置作为插入点。
const deleteChar = (
    formula: Formula,
    index: number,
    precision: number,
): { formula: Formula; cursor: number } => {
    const full = formula.flat();
    full.splice(index, 1);
    // 删除左操作数后，移除失去操作数的运算符，保留合法的负号。
    if (isOperator(full[0]) && (full[0] !== "-" || full.length === 1)) {
        full.shift();
    }
    const newFormula = arrayToFormula(full, precision);
    return {
        formula: newFormula,
        cursor: Math.min(index, toText(newFormula).length),
    };
};

// --- Components ---
export const CalculatorRoot = ({
    children,
    initialValue,
    onValueChange,
    precision = 3,
    multiplyKey,
}: {
    initialValue?: number;
    onValueChange?: (v: number) => void;
    children: React.ReactNode;
    precision?: number;
    multiplyKey?: "double-zero" | "triple-zero";
}) => {
    const [state, setState] = useState(() => {
        const formula = numberToFormula(initialValue ?? 0);
        return { formula, cursor: toText(formula).length };
    });

    const valueRef = useRef<HTMLDivElement>(null);

    const Layout = useMemo(() => getLayout(multiplyKey), [multiplyKey]);

    const setCursor = useCallback(
        (position: number | ((cursor: number) => number)) => {
            setState((prev) => {
                const next =
                    typeof position === "number"
                        ? position
                        : position(prev.cursor);
                const cursor = Math.max(
                    0,
                    Math.min(next, toText(prev.formula).length),
                );
                return cursor === prev.cursor ? prev : { ...prev, cursor };
            });
        },
        [],
    );

    const handleButtonClick = useCallback(
        (value: ButtonValue) => {
            if (value === "r") {
                return;
            }
            setState((state) => {
                const { formula, cursor } = state;
                let f = formula;
                let c = cursor;
                const keys = value === "Delete" ? [value] : value.split("");
                for (const ch of keys) {
                    const len = toText(f).length;
                    if (ch === "c" || ch === "Delete") {
                        const index = ch === "c" ? c - 1 : c;
                        if (index < 0 || index >= len) return state;
                        const r = deleteChar(f, index, precision);
                        f = r.formula;
                        c = r.cursor;
                    } else if (c >= len) {
                        // 光标在末尾：沿用既有的追加逻辑（运算符二次计算、= 等）
                        f = createFormula(ch, precision, f);
                        c = toText(f).length;
                    } else if (ch === "=") {
                        f = createFormula("=", precision, f);
                        c = toText(f).length;
                    } else {
                        const r = insertChar(f, c, ch, precision);
                        if (r) {
                            f = r.formula;
                            c = r.cursor;
                        }
                        // 非法字符：忽略
                    }
                }
                Promise.resolve().then(() => {
                    onValueChange?.(formulaToNumber(f, precision));
                });
                return { formula: f, cursor: c };
            });
        },
        [onValueChange, precision],
    );

    return (
        <CalculatorContext.Provider
            value={{
                handleButtonClick,
                valueRef,
                formula: state.formula,
                cursor: state.cursor,
                setCursor,
                Layout,
            }}
        >
            {children}
        </CalculatorContext.Provider>
    );
};

export const CalculatorValue = ({
    className,
    label,
    onConfirm,
}: {
    className?: string;
    label: string;
    onConfirm?: () => void;
}) => {
    const ctx = useContext(CalculatorContext);
    if (!ctx) {
        throw new Error("CalculatorValue must be used within Calculator.Root");
    }
    const { formula, cursor, setCursor, handleButtonClick, Layout, valueRef } =
        ctx;
    const [focused, setFocused] = useState(false);
    const text = toText(formula);
    const len = text.length;

    const containerRef = useRef<HTMLDivElement>(null);
    const spansRef = useRef<(HTMLSpanElement | null)[]>([]);
    const draggingRef = useRef(false);
    const [caretLeft, setCaretLeft] = useState(0);
    const [caretRevision, setCaretRevision] = useState(0);

    // 计算光标的水平位置（绝对定位，不影响文本布局）
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const spans = spansRef.current;
        const count = text.length;
        let left: number;
        if (count === 0) {
            // 文本右对齐，空内容时光标在右侧
            left = container.clientWidth - 4;
        } else if (cursor >= count) {
            const last = spans[count - 1];
            left = last ? last.offsetLeft + last.offsetWidth : 0;
        } else {
            const s = spans[cursor];
            left = s ? s.offsetLeft : 0;
        }
        setCaretLeft(left);
        // 长金额时保证光标可见
        if (left < container.scrollLeft) {
            container.scrollLeft = left;
        } else if (left + 2 > container.scrollLeft + container.clientWidth) {
            container.scrollLeft = left + 2 - container.clientWidth;
        }
    }, [text, cursor]);

    // 将指针的 clientX 映射到最近的字符边界索引
    const pointerToCursor = (clientX: number) => {
        const spans = spansRef.current;
        let best = len;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < len; i++) {
            const span = spans[i];
            if (!span) {
                continue;
            }
            const rect = span.getBoundingClientRect();
            for (const b of [
                { idx: i, x: rect.left },
                { idx: i + 1, x: rect.right },
            ]) {
                const d = Math.abs(clientX - b.x);
                if (d < bestDist) {
                    bestDist = d;
                    best = b.idx;
                }
            }
        }
        return best;
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: The calculator renders individual character spans for pointer caret placement.
        <div
            ref={(node) => {
                containerRef.current = node;
                valueRef.current = node;
            }}
            data-calculator-value
            role="textbox"
            aria-label={label}
            tabIndex={0}
            className={cn(
                "relative touch-none pr-1 focus-visible:outline focus-visible:outline-2",
                className,
            )}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
                if (
                    event.defaultPrevented ||
                    event.nativeEvent.isComposing ||
                    event.keyCode === 229 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                ) {
                    return;
                }
                if (event.key === "Enter") {
                    event.preventDefault();
                    onConfirm?.();
                    return;
                }
                switch (event.key) {
                    case "ArrowLeft":
                        setCursor((position) => position - 1);
                        break;
                    case "ArrowRight":
                        setCursor((position) => position + 1);
                        break;
                    case "Home":
                    case "ArrowUp":
                        setCursor(0);
                        break;
                    case "End":
                    case "ArrowDown":
                        setCursor(len);
                        break;
                    default: {
                        const key = event.key === "Backspace" ? "c" : event.key;
                        if (
                            key === "r" ||
                            (key !== "Delete" &&
                                !Layout.some((item) => item.label === key))
                        ) {
                            return;
                        }
                        event.preventDefault();
                        handleButtonClick(key);
                        return;
                    }
                }
                event.preventDefault();
                setCaretRevision((revision) => revision + 1);
            }}
            onPointerDown={(e) => {
                e.currentTarget.focus({ preventScroll: true });
                setCursor(pointerToCursor(e.clientX));
                setCaretRevision((revision) => revision + 1);
                e.currentTarget.setPointerCapture(e.pointerId);
                draggingRef.current = true;
            }}
            onPointerMove={(e) => {
                if (!draggingRef.current) {
                    return;
                }
                setCursor(pointerToCursor(e.clientX));
            }}
            onPointerUp={(e) => {
                draggingRef.current = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
        >
            {text.split("").map((v, i) => (
                <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional characters
                    key={i}
                    ref={(el) => {
                        spansRef.current[i] = el;
                    }}
                >
                    {v === "x" ? "×" : v}
                </span>
            ))}
            <span
                key={`caret:${text}:${cursor}:${caretRevision}`}
                aria-hidden
                className={cn(
                    "absolute top-0 bottom-0 w-[2px] bg-current pointer-events-none",
                    focused ? "calculator-caret-blink" : "invisible",
                )}
                style={{ left: caretLeft }}
            />
        </div>
    );
};

export const CalculatorKeyboard = ({
    className,
    onKey,
}: {
    className?: string;
    onKey?: (v: string) => void;
}) => {
    const t = useIntl();
    const { handleButtonClick, Layout, valueRef } =
        useContext(CalculatorContext)!;
    return (
        <div className={cn("grid grid-cols-8 gap-2", className)}>
            {Layout.map((row) => (
                <Button
                    variant="ghost"
                    key={row.label}
                    data-label={row.label}
                    type="button"
                    onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        handleButtonClick(row.label);
                        if (row.label !== "r") {
                            valueRef.current?.focus({ preventScroll: true });
                        }
                        onKey?.(row.label);
                    }}
                    onClick={(event) => {
                        // Keyboard and assistive-technology activation has no pointer event.
                        if (event.detail !== 0) return;
                        handleButtonClick(row.label);
                        if (row.label !== "r") {
                            valueRef.current?.focus({ preventScroll: true });
                        }
                        onKey?.(row.label);
                    }}
                    className={cn(
                        (row.cols ?? 1) > 1 && "col-span-2",
                        "h-full text-lg font-semibold bg-background/10 active:bg-background/50 transition-all py-1",
                        row.label === "c" && "bg-destructive/60",
                    )}
                >
                    {row.label === "c" ? (
                        <i className="icon-[mdi--clear-outline]"></i>
                    ) : row.label === "r" ? (
                        <div className="flex flex-col gap-1 items-center">
                            <i className="icon-[mdi--reload]"></i>
                            <div className="text-xs">{t("add-again")}</div>
                        </div>
                    ) : row.label === "x" ? (
                        <span data-label>×</span>
                    ) : (
                        <span data-label>{row.label}</span>
                    )}
                </Button>
            ))}
        </div>
    );
};

const Calculator = {
    Root: CalculatorRoot,
    Value: CalculatorValue,
    Keyboard: CalculatorKeyboard,
};

export default Calculator;
