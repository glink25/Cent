import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import BudgetEditForm from "./form";
import BudgetListForm from "./list";

export const [BudgetProvider, showBudget] = createConfirmProvider(
	BudgetListForm,
	{
		dialogTitle: "Budget",
		dialogModalClose: true,
		contentClassName:
			"h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
	},
);

export const [BudgetEditProvider, showBudgetEdit] = createConfirmProvider(
	BudgetEditForm,
	{
		dialogTitle: "Budget Edit",
		contentClassName:
			"h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
	},
);

export default function Budget() {
	const t = useIntl();
	return (
		<div className="backup">
			<Button
				onClick={() => {
					showBudget();
				}}
				variant="ghost"
				className="w-full py-4 rounded-none h-auto"
			>
				<div className="w-full px-4 flex justify-between items-center">
					<div className="flex items-center gap-2">
						<i className="icon-[mdi--calculator] size-5"></i>
						{t("budget-manager")}
					</div>
					<i className="icon-[mdi--chevron-right] size-5"></i>
				</div>
			</Button>
		</div>
	);
}
