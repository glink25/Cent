import { useLayoutEffect, useRef, useState } from "react";
import { cancelExternalApprovals, useExternalApprovals } from "@/agent/changes";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "./ui/dialog";

type Approval = ReturnType<
    typeof useExternalApprovals.getState
>["items"][number];

function ApprovalDialog({ item }: { item: Approval }) {
    const t = useIntl();
    const [remember, setRemember] = useState(false);
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) item.decide(false);
            }}
        >
            <DialogPortal>
                <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
                <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
                    <DialogContent className="pointer-events-auto w-full max-w-md rounded-xl border bg-background p-4 shadow-xl">
                        <DialogTitle className="font-semibold">
                            {t("agent-change-approval")}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-muted-foreground">
                            {item.proposal.title}
                        </DialogDescription>
                        <details className="my-3 text-sm" open>
                            <summary className="cursor-pointer">
                                {t("agent-change-details")} (
                                {item.proposal.diffs.length})
                            </summary>
                            <div className="mt-2 max-h-[40dvh] overflow-auto break-all whitespace-pre-wrap font-mono text-xs">
                                {item.proposal.diffs.map(
                                    ({ target, before, after }) => (
                                        <div key={target} className="mb-2">
                                            {target}
                                            {before !== undefined && (
                                                <div className="text-red-600">
                                                    −{" "}
                                                    {JSON.stringify(
                                                        before,
                                                        null,
                                                        2,
                                                    )}
                                                </div>
                                            )}
                                            {after !== undefined && (
                                                <div className="text-green-700 dark:text-green-400">
                                                    +{" "}
                                                    {JSON.stringify(
                                                        after,
                                                        null,
                                                        2,
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ),
                                )}
                            </div>
                        </details>
                        {item.proposal.canRemember && (
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(event) =>
                                        setRemember(event.target.checked)
                                    }
                                />
                                {t("agent-change-remember")}
                            </label>
                        )}
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => item.decide(false)}
                            >
                                {t("cancel")}
                            </Button>
                            <Button onClick={() => item.decide(true, remember)}>
                                {t("confirm")}
                            </Button>
                        </div>
                    </DialogContent>
                </div>
            </DialogPortal>
        </Dialog>
    );
}

export default function WebMcpApproval() {
    const item = useExternalApprovals((state) => state.items[0]);
    const book = useBookStore((state) => state.currentBookId);
    const viewer = useUserStore((state) => state.id);
    const scope = JSON.stringify([book, viewer]);
    const previous = useRef(scope);
    useLayoutEffect(() => {
        if (previous.current !== scope) {
            previous.current = scope;
            cancelExternalApprovals();
        }
    }, [scope]);
    return item ? <ApprovalDialog key={item.proposal.id} item={item} /> : null;
}
