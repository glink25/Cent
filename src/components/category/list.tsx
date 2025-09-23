import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";

export default function CategoryList({
	onCancel,
}: {
	edit?: any;
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const t = useIntl();
	return (
		<PopupLayout onBack={onCancel} title={t("edit-categories")}></PopupLayout>
	);
}
