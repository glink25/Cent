// Caculator.tsx

import { createContext, useContext, useState } from "react";
import { cn } from "@/utils";
import { Button } from "./ui/button";

type Char = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "0";
type Operator = "+" | "-" | "x" | "/";
type Eraser = "c";
type Point = ".";
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

const operators = ["+", "-", "x", "/"];

const isOperator = (v: string): v is Operator => operators.includes(v);

const padZero = (v: (Operator | "." | Char)[]) => {
	if (v[0] === "0" && v.length > 1 && v[1] !== ".") {
		return padZero(v.slice(1));
	}
	return v;
};

const arrayToFormula = (full: (Operator | "." | Char)[]) => {
	const opIndex = full.findIndex((v, i) => i !== 0 && isOperator(v));
	if (opIndex === -1) {
		return [padZero(full)] as Formula;
	}
	const left = full.slice(0, opIndex);
	const right = full.slice(opIndex + 1);
	return [padZero(left), full[opIndex], padZero(right)].filter(
		(v) => v.length > 0,
	) as Formula;
};

const numToNumber = (num: Num) => {
	if (num.length === 0) {
		return 0;
	}
	return Number(num.join(""));
};

const formulaToNumber = (form: Formula) => {
	const [leftNum, op, rightNum] = form;
	const left = numToNumber(leftNum);
	if (op === undefined || rightNum === undefined) {
		return left;
	}
	const right = numToNumber(rightNum);
	const prec = (v: number) => Number(v.toPrecision(3));
	switch (op) {
		case "+":
			return prec(left + right);
		case "-":
			return prec(left - right);
		case "x":
			return prec(left * right);
		case "/":
			return prec(left / right);
	}
};

const createFormula = (_value: string | number, _prev?: Formula) => {
	const prev = _prev ?? [["0"]];
	const value = `${_value}` as Value;
	if (value === "c") {
		const full = prev.flat();
		full.pop();
		return arrayToFormula(full);
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
			const result = [`${formulaToNumber(prev)}`.split("")] as Formula;
			return createFormula(value, result);
		}
		// 否则直接追加
		prev[1] = value;
		return [...prev] as Formula;
	}
	if (value === "=") {
		return [`${formulaToNumber(prev)}`.split("")] as Formula;
	}

	const full = prev.flat();
	if (full.length > 16) {
		return prev;
	}
	full.push(value);
	return arrayToFormula(full);
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
}: {
	initialValue?: number;
	onValueChange?: (v: number) => void;
	children: React.ReactNode;
}) => {
	const [currentFormula, setCurrentFormula] = useState(() =>
		numberToFormula(initialValue ?? 0),
	);

	const handleButtonClick = (value: ButtonValue) => {
		if (value === "r") {
			return;
		}
		setCurrentFormula((prev) => {
			const newFormula = createFormula(value, prev);
			onValueChange?.(formulaToNumber(newFormula));
			return newFormula;
		});
	};

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
	return <div className={cn(className)}>{toText(formula)}</div>;
};

export const CalculatorKeyboard = ({ className }: { className?: string }) => {
	const { handleButtonClick } = useContext(CalculatorContext)!;

	return (
		<div className={cn("grid grid-cols-5 gap-2", className)}>
			{Layout.map((row) => (
				<Button
					variant="ghost"
					key={row.label}
					data-label={row.label}
					onPointerDown={() => handleButtonClick(row.label)}
					className={cn(
						(row.cols ?? 1) > 1 && "col-span-2",
						"h-full text-lg font-semibold bg-background/10 active:bg-background/50 transition-all",
					)}
				>
					{row.label}
				</Button>
			))}
		</div>
	);
};

const Caculator = {
	Root: CalculatorRoot,
	Value: CalculatorValue,
	Keyborad: CalculatorKeyboard,
};

export default Caculator;
