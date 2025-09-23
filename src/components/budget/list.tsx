import dayjs from "dayjs";
import { useBudget } from "@/hooks/use-budget";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { showBudgetEdit } from ".";

const toDay = (v: number) => dayjs.unix(v / 1000).format("YYYY-MM-DD");

export default function BudgetListForm({
	onCancel,
}: {
	edit?: any;
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const t = useIntl();
	const { budgets, add, update } = useBudget();
	return (
		<PopupLayout onBack={onCancel} title={t("budget-manager")}>
			<div className="w-full flex-1 overflow-y-auto flex flex-col gap-2 p-2">
				<Button
					variant="outline"
					onClick={async () => {
						const newBudget = await showBudgetEdit();
						if (!newBudget) {
							return;
						}

						await add(newBudget);
					}}
				>
					<i className="icon-[mdi--add]" />
					Add a Budget
				</Button>
				{budgets.map((budget) => {
					return (
						<div
							key={budget.id}
							className="border rounded-md shadow-md py-2 px-4 bg-green-900 text-white flex items-center gap-2"
						>
							<div className="h-full flex-1 flex flex-col items-between justify-between">
								<div className="flex-1 flex flex-col gap-2">
									<div className="w-full flex justify-between items-center">
										<div>{budget.title}</div>
										<div className="text-3xl">
											{budget.totalBudget +
												(budget.categoriesBudget?.reduce(
													(p, c) => p + c.budget,
													0,
												) ?? 0)}
										</div>
									</div>
									<div className="w-full text-xs flex items-center justify-between gap-2">
										<div className="flex-1 flex items-center justify-between">
											<div className="flex gap-1">
												<div>{toDay(budget.start)}</div>
												{budget.end && (
													<>
														<div>-</div>
														<div>{toDay(budget.end)}</div>
													</>
												)}
												<div>-</div>
												{t("repeat-by-value-unit", {
													value: budget.repeat.value,
													unit: t(budget.repeat.unit),
												})}
											</div>
											<div>
												{(budget.categoriesBudget?.length ?? 0) > 0 && (
													<div>包含分类预算</div>
												)}
											</div>
										</div>
										<div className="flex justify-center items-center gap-2">
											<Button
												size="sm"
												variant="secondary"
												className="w-[24px] h-[24px] text-xs p-0"
												onClick={async () => {
													const id = budget.id;
													const newBudget = await showBudgetEdit(budget);
													if (!newBudget) {
														return;
													}

													await update(id, newBudget);
												}}
											>
												<i className="icon-[mdi--edit-outline]" />
											</Button>
											<Button
												variant="destructive"
												className="w-[24px] h-[24px] p-0"
												onClick={async () => {
													const ok = confirm(
														"Are you sure to delete the budget?",
													);
													if (!ok) {
														return;
													}
													const id = budget.id;
													await update(id);
												}}
											>
												<i className="icon-[mdi--delete]" />
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</PopupLayout>
	);
}
