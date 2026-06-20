import { useEffect, useState } from "react";
import { type AgentApiAdapter, getActiveAdapter } from "@/agent-api";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

// The active adapter, resolved once by the settings item below. The shell
// `Form` renders whichever settings UI that adapter owns.
let activeAdapter: AgentApiAdapter | null = null;

function Form({ onCancel }: { onCancel?: () => void }) {
    const adapter = activeAdapter;
    if (!adapter) return null;
    const View = adapter.SettingsView;
    return <View onCancel={onCancel} />;
}

const [AgentApiProvider, showAgentApi] = createConfirmProvider(Form, {
    dialogTitle: "agent-api",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
});

export default function AgentApiSettingsItem() {
    const t = useIntl();
    // undefined = resolving, null = no supported adapter (hide feature)
    const [adapter, setAdapter] = useState<AgentApiAdapter | null | undefined>(
        undefined,
    );

    useEffect(() => {
        getActiveAdapter().then((a) => {
            activeAdapter = a;
            setAdapter(a);
        });
    }, []);

    if (adapter === null) return null;

    return (
        <div className="agent-api">
            <Button
                onClick={() => showAgentApi()}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
                disabled={adapter === undefined}
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--api] size-5"></i>
                        {t("agent-api")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <AgentApiProvider />
        </div>
    );
}
