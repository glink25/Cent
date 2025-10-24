// Caculator.tsx

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "./ui/button";

const charKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
const pointKey = ".";

type Char = (typeof charKeys)[number];
type Operator = "+" | "-" | "x" | "÷";
type Eraser = "c";
type Point = typeof pointKey;
type Eq = "=";
type Value = Char | Operator | Point | Eraser | Eq;

//[ '0','1','2','.','4','5'] -> 012.45
type Num = (Char | Point)[];

//[[ '0','1','2','.','4','5'],"+",['1']] -> 012.45+1
type Formula = [Num] | [Num, Operator] | [Num, Operator, Num];

type CalculatorContextType = {
    handleButtonClick: (value: ButtonValue) => void;
    formula: Formula;
};

type ButtonValue = string;
// --- Context ---
const CalculatorContext = createContext<CalculatorContextType | null>(null);

const Layout = [
    { label: "1" },
    { label: "2" },
    { label: "3" },
    { label: "c", cols: 2 },
    { label: "4" },
    { label: "5" },
    { label: "6" },
    { label: "+" },
    { label: "-" },
    { label: "7" },
    { label: "8" },
    { label: "9" },
    { label: "x" },
    { label: "÷" },
    { label: "r" },
    { label: "0" },
    { label: "." },
    { label: "=", cols: 2 },
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
    if (value === "c") {
        const full = prev.flat();
        full.pop();
        return arrayToFormula(full, precision);
    }
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

// --- Components ---
export const CalculatorRoot = ({
    children,
    initialValue,
    onValueChange,
    precision = 3,
    input,
}: {
    initialValue?: number;
    onValueChange?: (v: number) => void;
    children: React.ReactNode;
    precision?: number;
    input?: boolean;
}) => {
    const [currentFormula, setCurrentFormula] = useState(() =>
        numberToFormula(initialValue ?? 0),
    );

    const handleButtonClick = useCallback(
        (value: ButtonValue) => {
            if (value === "r") {
                return;
            }

            setCurrentFormula((currentFormula) => {
                const newFormula = createFormula(
                    value,
                    precision,
                    currentFormula,
                );
                Promise.resolve().then(() => {
                    onValueChange?.(formulaToNumber(newFormula, precision));
                });
                return newFormula;
            });
        },
        [onValueChange, precision],
    );

    useEffect(() => {
        if (input) {
            const onPress = (event: KeyboardEvent) => {
                const key = event.key;
                if (Layout.every((k) => k.label !== key)) {
                    return;
                }
                handleButtonClick(key);
            };
            const onKeydown = (event: KeyboardEvent) => {
                const key = event.key;
                if (key === "Backspace") {
                    event.preventDefault();
                    handleButtonClick("c");
                }
            };
            document.addEventListener("keypress", onPress);
            document.addEventListener("keydown", onKeydown);

            return () => {
                document.removeEventListener("keypress", onPress);
                document.removeEventListener("keydown", onKeydown);
            };
        }
    }, [input, handleButtonClick]);

    return (
        <CalculatorContext.Provider
            value={{ handleButtonClick, formula: currentFormula }}
        >
            {children}
        </CalculatorContext.Provider>
    );
};

export const CalculatorValue = ({ className }: { className?: string }) => {
    const { formula } = useContext(CalculatorContext)!;
    return (
        <div className={cn(className)}>
            {toText(formula)
                .split("")
                .map((v, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                    <span key={i}>{v === "x" ? "×" : v}</span>
                ))}
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
    const { handleButtonClick } = useContext(CalculatorContext)!;
    return (
        <div className={cn("grid grid-cols-5 gap-2", className)}>
            {Layout.map((row) => (
                <Button
                    variant="ghost"
                    key={row.label}
                    data-label={row.label}
                    onPointerDown={() => {
                        handleButtonClick(row.label);
                        onKey?.(row.label);
                    }}
                    className={cn(
                        (row.cols ?? 1) > 1 && "col-span-2",
                        "h-full text-lg font-semibold bg-background/10 active:bg-background/50 transition-all",
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
