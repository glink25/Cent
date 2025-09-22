import { useMemo, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { Button } from "../ui/button";
import type { Budget } from "./type";

("use client");

import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { CalendarIcon, Plus, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { CascadeSelect } from "../cascade";

// 表单结构验证
const formSchema = z.object({
	title: z.string(),
	start: z.date({
		error: "请选择开始日期",
	}),
	end: z.date().optional(),
	repeat: z.object({
		unit: z.enum(["week", "day", "month", "year"], {
			error: "请选择重复单位",
		}),
		value: z.number().int().positive({
			message: "重复值必须是正整数",
		}),
	}),
	joiners: z
		.array(z.union([z.string(), z.number()]))
		.refine((value) => value.some((item) => item), {
			message: "至少选择一位参与者",
		}),
	totalBudget: z.coerce.number().min(0, {
		message: "总预算不能为负数",
	}),
	categoriesBudget: z
		.array(
			z.object({
				id: z.string({ error: "请选择一个类别" }),
				budget: z.coerce.number().min(0, {
					message: "预算不能为负数",
				}),
			}),
		)
		.optional(),
});

type EditBudget = Omit<Budget, "id"> & { id?: string };

export default function BudgetEditForm({
	edit,
	onConfirm,
	onCancel,
}: {
	edit?: EditBudget;
	onConfirm?: (v?: EditBudget) => void;
	onCancel?: () => void;
}) {
	const t = useIntl();
	const joiners = useCreators();
	const { expenses } = useCategory();
	const categoryOption = useMemo(
		() =>
			expenses.map((v) => ({
				...v,
				name: v.custom ? v.name : t(v.name),
				children: v.children.map((c) => ({
					...c,
					name: c.custom ? c.name : t(c.name),
				})),
			})),
		[expenses, t],
	);
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema) as any,
		defaultValues: edit
			? {
					...edit,
					start: edit?.start
						? dayjs.unix(edit.start / 1000).toDate()
						: undefined,
					end: edit?.end ? dayjs.unix(edit.end / 1000).toDate() : undefined,
				}
			: {
					title: "New Budget",
					start: new Date(),
					joiners: [],
					totalBudget: 0,
					repeat: {
						value: 1,
						unit: "month",
					},
				},
	});

	const { fields, append, remove } = useFieldArray({
		name: "categoriesBudget",
		control: form.control,
	});

	function onSubmit(data: z.infer<typeof formSchema>) {
		// 将 date 对象转换为 number
		const formattedData = {
			...data,
			start: data.start.getTime(),
			end: data.end ? data.end.getTime() : undefined,
		};
		console.log(formattedData);
		onConfirm?.(formattedData);
	}
	return (
		<Form {...form}>
			<form className="h-full w-full" onSubmit={form.handleSubmit(onSubmit)}>
				<PopupLayout
					className="h-full sm:h-[55vh] gap-2"
					onBack={onCancel}
					title={
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											placeholder="请输入预算标题"
											{...field}
											maxLength={50}
											className="text-center"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					}
				>
					<div className="flex-1 w-full overflow-y-auto flex flex-col px-4 gap-2 pb-20">
						{/* 日期选择 */}
						<div className="flex gap-4">
							<FormField
								control={form.control}
								name="start"
								render={({ field }) => (
									<FormItem className="flex flex-col flex-1">
										<FormLabel>开始日期</FormLabel>
										<Popover>
											<FormControl>
												<PopoverTrigger asChild>
													<Button
														variant={"outline"}
														className={cn(
															"w-full pl-3 text-left font-normal",
															!field.value && "text-muted-foreground",
														)}
													>
														{field.value ? (
															field.value.toLocaleDateString()
														) : (
															<span>请选择开始日期</span>
														)}
														<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
													</Button>
												</PopoverTrigger>
											</FormControl>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													className="min-w-[240px]"
													mode="single"
													selected={field.value}
													onSelect={field.onChange}
													disabled={(date) =>
														date > new Date() || date < new Date("1900-01-01")
													}
													initialFocus
												/>
											</PopoverContent>
										</Popover>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="end"
								render={({ field }) => (
									<FormItem className="flex flex-col flex-1">
										<FormLabel>结束日期 (可选)</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant={"outline"}
														className={cn(
															"w-full pl-3 text-left font-normal",
															!field.value && "text-muted-foreground",
														)}
													>
														{field.value ? (
															field.value.toLocaleDateString()
														) : (
															<span>请选择结束日期</span>
														)}
														<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="end">
												<Calendar
													mode="single"
													className="min-w-[240px]"
													selected={field.value}
													onSelect={field.onChange}
													disabled={(date) => date < form.getValues("start")}
													initialFocus
												/>
											</PopoverContent>
										</Popover>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* 参与者选择 */}
						<FormField
							control={form.control}
							name="joiners"
							render={() => (
								<FormItem>
									<FormLabel>参与者</FormLabel>
									<FormDescription>选择所有参与者。</FormDescription>
									{joiners.map((item) => (
										<FormField
											key={item.id}
											control={form.control}
											name="joiners"
											render={({ field }) => {
												return (
													<FormItem className="flex flex-row items-start space-x-3 space-y-0">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(item.id)}
																onCheckedChange={(checked) => {
																	return checked
																		? field.onChange([...field.value, item.id])
																		: field.onChange(
																				field.value?.filter(
																					(value) => value !== item.id,
																				),
																			);
																}}
															/>
														</FormControl>
														<FormLabel className="font-normal">
															{item.name}
														</FormLabel>
													</FormItem>
												);
											}}
										/>
									))}
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* 总预算 */}
						<FormField
							control={form.control}
							name="totalBudget"
							render={({ field }) => (
								<FormItem>
									<FormLabel>总预算</FormLabel>
									<FormControl>
										<Input
											type="number"
											placeholder="请输入总预算"
											{...field}
											onChange={(event) => {
												field.onChange(event.target.valueAsNumber);
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex flex-col gap-2 rounded-md border p-4">
							<h3 className="text-lg font-medium">周期</h3>
							<p className="text-sm text-muted-foreground">设定预算周期</p>
							<div className="flex items-center justify-between">
								<div>每隔：</div>
								<div className="flex items-center gap-2">
									<FormField
										control={form.control}
										name="repeat.value"
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Input
														type="number"
														step="1"
														className="text-end"
														placeholder="xx"
														{...field}
														onChange={(event) => {
															field.onChange(event.target.valueAsNumber);
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="repeat.unit"
										render={({ field }) => (
											<FormItem className="space-y-0">
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="单位" />
														</SelectTrigger>
													</FormControl>
													<SelectContent align="end">
														<SelectItem value="day">天</SelectItem>
														<SelectItem value="week">周</SelectItem>
														<SelectItem value="month">月</SelectItem>
														<SelectItem value="year">年</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>
						</div>

						{/* 分类预算列表 */}
						<div className="flex flex-col gap-2 rounded-md border p-4">
							<h3 className="text-lg font-medium">分类预算</h3>
							<p className="text-sm text-muted-foreground">
								可以为不同类别分配具体预算。
							</p>
							{fields.map((field, index) => (
								<div
									key={field.id}
									className="flex gap-4 justify-center items-center"
								>
									<div className="flex-1">
										<FormField
											control={form.control}
											name={`categoriesBudget.${index}.id`}
											render={({ field: categoryField }) => (
												<FormItem className="space-y-0">
													<FormLabel>类别</FormLabel>
													<CascadeSelect
														align="end"
														value={categoryField.value}
														onValueChange={categoryField.onChange}
														list={categoryOption}
													></CascadeSelect>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="flex-1">
										<FormField
											control={form.control}
											name={`categoriesBudget.${index}.budget`}
											render={({ field: budgetField }) => (
												<FormItem>
													<FormLabel>预算金额</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="请输入预算金额"
															{...budgetField}
															onChange={(event) => {
																budgetField.onChange(
																	event.target.valueAsNumber,
																);
															}}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
									<Button
										type="button"
										variant="destructive"
										size="icon"
										onClick={() => remove(index)}
										className="self-end"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="mt-2"
								onClick={() => append({ id: "", budget: 0 })}
							>
								<Plus className="h-4 w-4 mr-2" />
								新增分类预算
							</Button>
						</div>
					</div>
					<div className="p-2 w-full flex justify-end">
						<Button type="submit" className="sm:w-fit w-full">
							{t("confirm")}
						</Button>
					</div>
				</PopupLayout>
			</form>
		</Form>
	);
}
