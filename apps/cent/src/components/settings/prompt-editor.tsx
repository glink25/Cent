import { type ReactNode, useId, useRef, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";

export function PromptEditorItem({
    stored,
    defaultValue = "",
    description,
    resetLabel,
    onSave,
    children,
}: {
    stored: string;
    defaultValue?: string;
    description: string;
    resetLabel: string;
    onSave: (value: string, reset: boolean) => void | Promise<void>;
    children?: ReactNode;
}) {
    const t = useIntl();
    const id = useId();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(stored);
    const [reset, setReset] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const pending = useRef(false);
    const title = t("edit-custom-prompt");

    function changeOpen(next: boolean) {
        if (pending.current) return;
        if (next) {
            setDraft(stored);
            setReset(false);
            setFailed(false);
        }
        setOpen(next);
    }

    async function save() {
        if (pending.current) return;
        pending.current = true;
        setSaving(true);
        setFailed(false);
        try {
            await onSave(draft, reset);
            setOpen(false);
        } catch {
            setFailed(true);
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-between rounded-none px-4"
                >
                    {title}
                    <i className="icon-[mdi--chevron-right] size-5" />
                </Button>
            </DialogTrigger>
            <DialogPortal>
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <DialogContent
                        aria-describedby={id}
                        onEscapeKeyDown={(event) => {
                            if (pending.current) event.preventDefault();
                        }}
                        onInteractOutside={(event) => event.preventDefault()}
                        className="pointer-events-auto flex h-full w-full bg-background sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-md"
                    >
                        <PopupLayout
                            title={<DialogTitle>{title}</DialogTitle>}
                            onBack={() => changeOpen(false)}
                            hideBack={saving}
                            right={
                                <Button
                                    size="sm"
                                    disabled={saving}
                                    onClick={save}
                                >
                                    {t("save")}
                                </Button>
                            }
                        >
                            <div className="space-y-3 overflow-y-auto p-4">
                                <label
                                    id={id}
                                    htmlFor={`${id}-prompt`}
                                    className="block text-sm opacity-70"
                                >
                                    {description}
                                </label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={saving}
                                    onClick={() => {
                                        setDraft(defaultValue);
                                        setReset(true);
                                    }}
                                >
                                    {resetLabel}
                                </Button>
                                <textarea
                                    id={`${id}-prompt`}
                                    className="w-full min-h-60 border rounded-lg p-2 text-xs font-mono"
                                    value={draft}
                                    disabled={saving}
                                    onChange={(event) => {
                                        setDraft(event.currentTarget.value);
                                        setReset(false);
                                    }}
                                />
                                {children}
                                {failed && (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {t(
                                            "assistant-extra-prompt-save-failed",
                                        )}
                                    </p>
                                )}
                            </div>
                        </PopupLayout>
                    </DialogContent>
                </div>
            </DialogPortal>
        </Dialog>
    );
}
