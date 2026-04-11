import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import MainAssistant from "./main";

export default function AssistantForm({
    edit,
    onCancel,
}: {
    edit?: any;
    onConfirm?: (v?: any) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    return (
        <PopupLayout
            title={t("ai-assistant")}
            right={<MainAssistant.Actions />}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <MainAssistant.Content />
        </PopupLayout>
    );
}
