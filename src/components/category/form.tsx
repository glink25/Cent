import PopupLayout from "@/layouts/popup-layout";
import createConfirmProvider from "../confirm";
import { useIntl } from "@/locale";
import type { BillCategory } from "@/ledger/type";
import { useState } from "react";
import { cn } from "@/utils";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "../ui/form";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ICONS } from "./icons";
import CategoryIcon from "./icon";

const formSchema = z.object({
	name: z.string().max(50),
});

const allIcons = Array.from(Object.entries(ICONS)).map(([key, value]) => ({
	label: key,
	list: value,
}));

const validSvgText = (text: string) =>
	text.startsWith("<svg") && text.endsWith("</svg>");

export default function CategoryEditForm({
	onCancel,
	edit,
}: {
	edit?: BillCategory | (Partial<BillCategory> & { parent: string });
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const t = useIntl();
	const [category, setCategory] = useState(edit);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema) as any,
		defaultValues: category
			? {
					name: category.custom
						? (category.name ?? "")
						: category?.name
							? t(category?.name)
							: "",
				}
			: {
					name: "",
				},
	});
	return (
		<Form {...form}>
			<PopupLayout
				className="overflow-hidden w-full h-full flex-col gap-2 items-center"
				onBack={onCancel}
				title={t("edit-category-details")}
				right={
					<div className="flex items-center gap-2 pr-2">
						<Button variant="destructive" size="sm">
							<i className="icon-[mdi--trash-can-outline]" />
						</Button>
						<Button size="sm">{t("confirm")}</Button>
					</div>
				}
			>
				<div className="p-4 size-16 aspect-square rounded-full overflow-hidden border flex justify-center items-center">
					{category?.icon && (
						<CategoryIcon
							icon={category?.icon}
							className={cn("w-full h-full")}
						/>
					)}
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem className="flex space-y-0 items-center gap-2">
							<div className="text-sm opacity-80 whitespace-nowrap">
								{t("category-name")}
							</div>
							<FormControl>
								<Input type="text" maxLength={50} {...field} />
							</FormControl>
						</FormItem>
					)}
				></FormField>
				<Tabs
					defaultValue="icons"
					className="w-full flex flex-col flex-1 overflow-hidden p-2 gap-2"
				>
					<div className="w-full flex justify-center">
						<div className="flex items-center gap-2">
							<div className="text-sm opacity-80">Change Icon</div>
							<TabsList>
								<TabsTrigger value="icons">Icons</TabsTrigger>
								<TabsTrigger value="custom">Custom</TabsTrigger>
							</TabsList>
						</div>
					</div>
					<div className="flex-1 overflow-y-auto border rounded-lg p-2">
						<TabsContent value="icons" className="flex flex-col gap-2">
							{allIcons.map((iconSet) => (
								<div key={iconSet.label} className="flex flex-col gap-2">
									<div className="text-sm">{iconSet.label}</div>
									<div className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2">
										{iconSet.list.map((icon) => (
											<button
												key={icon.name}
												type="button"
												onClick={() => {
													setCategory(
														(v) => ({ ...v, icon: icon.className }) as any,
													);
												}}
												className="size-12 p-2 rounded-full border flex justify-center items-center cursor-pointer"
											>
												<i className={cn(icon.className)}></i>
											</button>
										))}
									</div>
								</div>
							))}
						</TabsContent>
						<TabsContent
							value="custom"
							className="w-full h-full flex flex-col gap-2 m-0"
						>
							<div className="w-full h-full flex flex-col gap-2">
								<div className="text-sm opacity-80 flex justify-between items-center px-2">
									<div>Copy & paste SVG below:</div>
									<Button size="sm">清空</Button>
								</div>
								<textarea
									className="w-full flex-1 border rounded-lg p-2"
									onChange={(e) => {
										const svgText = e.currentTarget.value;
										if (!svgText || !validSvgText(svgText)) {
											setCategory((v) => ({ ...v, icon: v?.icon }) as any);
											return;
										}
										setCategory((v) => ({ ...v, icon: svgText }) as any);
									}}
								/>
							</div>
						</TabsContent>
					</div>
				</Tabs>
			</PopupLayout>
		</Form>
	);
}

export const [CategoryEditFormProvider, showCategoryEdit] =
	createConfirmProvider(CategoryEditForm, {
		dialogTitle: "Category Edit",
		contentClassName:
			"h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
	});
