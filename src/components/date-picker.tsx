import dayjs, { type Dayjs } from "dayjs";
import type React from "react";
import { useEffect, useRef } from "react";

type Props = {
	value?: number;
	formatter?: (time: number) => string;
	displayFormatter?: string | ((time: Dayjs) => string);
	onChange?: (value: number) => void;
	children?: React.ReactNode;
};

export function DatePicker<T extends string | Dayjs = string>({
	value,
	formatter,
	displayFormatter = "MM-DD",
	onChange,
	children,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);

	// display 格式化函数
	const display =
		typeof displayFormatter === "function"
			? displayFormatter
			: (d: Dayjs) => d.format(displayFormatter as string);

	// 初始值处理（等价于 Vue: if props.modelValue === undefined）
	useEffect(() => {
		if (value === undefined) {
			const now = dayjs().unix();
			// const initial = formatter?.(now) ?? now;
			onChange?.(now);
		}
	}, [value, onChange]);

	const onClickInput = (e: React.MouseEvent<HTMLInputElement>) => {
		// 调用原生 datetime-local 的选择器
		(e.target as HTMLInputElement).showPicker?.();
	};

	const onTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		const time = dayjs(value).unix();
		// const formatted = formatter?.(time) ?? time;
		onChange?.(time);
	};

	const current = value ? dayjs(value as any) : dayjs();

	return (
		<label className="flex items-center relative">
			{children}
			<div className="mx-2">{display(current)}</div>
			<input
				ref={inputRef}
				type="datetime-local"
				className="absolute top-0 left-0 w-2 h-full opacity-0"
				onClick={onClickInput}
				onChange={onTimeChange}
			/>
		</label>
	);
}
