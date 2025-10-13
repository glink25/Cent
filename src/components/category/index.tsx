import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import CategoryList from "./list";

export const [CategoryListProvider, showCategoryList] = createConfirmProvider(
	CategoryList,
	{
		dialogTitle: "Category",
		dialogModalClose: true,
		contentClassName:
			"h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
	},
);

export default function CategorySettingsItem() {
	const t = useIntl();
	return (
		<div className="backup">
			<Button
				onClick={() => {
					showCategoryList();
				}}
				variant="ghost"
				className="w-full py-4 rounded-none h-auto"
			>
				<div className="w-full px-4 flex justify-between items-center">
					<div className="flex items-center gap-2">
						<i className="icon-[mdi--view-grid-outline] size-5"></i>
						{t("edit-categories")}
					</div>
					<i className="icon-[mdi--chevron-right] size-5"></i>
				</div>
			</Button>
		</div>
	);
}
