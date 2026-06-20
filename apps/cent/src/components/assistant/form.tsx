import { MainAssistant } from "@glink25/chaty/ui";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";

export default function AssistantForm({
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
            {/* 移动端弹窗自带标题与 Actions，隐藏 Content 内置头部避免重复。 */}
            <MainAssistant.Content hideHeader />
        </PopupLayout>
    );
}
