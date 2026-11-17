import { useEffect, useRef, useState } from "react";
import type { ChangeProposal, ChangeReceipt } from "../../assistant";
import { useI18n } from "./i18n";

export function ChangeCard({
    proposal,
    receipt,
    decide,
    undo,
    undoDisabled,
}: {
    proposal: ChangeProposal;
    receipt?: ChangeReceipt;
    decide?: (approved: boolean, remember?: boolean) => void;
    undo?: () => void | Promise<void>;
    undoDisabled?: boolean;
}) {
    const { t } = useI18n();
    const card = useRef<HTMLDivElement>(null);
    const pending = !!decide;
    useEffect(() => {
        if (pending) card.current?.scrollIntoView({ block: "nearest" });
    }, [pending]);
    const [remember, setRemember] = useState(false);
    const status =
        receipt?.status === "undone"
            ? "changeUndone"
            : receipt?.status === "applied"
              ? "changeApplied"
              : receipt
                ? "changeResult"
                : "changePending";
    const affected = receipt?.results.filter(
        (item) => item.status === "applied",
    ).length;
    const counts = {
        create: proposal.diffs.filter((diff) => diff.before === undefined)
            .length,
        delete: proposal.diffs.filter((diff) => diff.after === undefined)
            .length,
        update: proposal.diffs.filter(
            (diff) => diff.before !== undefined && diff.after !== undefined,
        ).length,
    };
    return (
        <div
            ref={card}
            className="overflow-hidden rounded-2xl border bg-background text-sm shadow-sm"
        >
            <div className="flex items-start gap-3 p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <i
                        aria-hidden="true"
                        className={`${pending ? "icon-[mdi--shield-check-outline]" : "icon-[mdi--file-document-edit-outline]"} size-5`}
                    />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium text-foreground">
                        {t(pending ? "changePermission" : status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {proposal.diffs.length} {t("changeObjects")}
                        {affected !== undefined && (
                            <span className="ml-2">
                                {affected} {t("changeApplied")}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {(["create", "update", "delete"] as const)
                            .filter((action) => counts[action])
                            .map((action) => (
                                <span
                                    key={action}
                                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                    {t(
                                        action === "create"
                                            ? "changeCreate"
                                            : action === "update"
                                              ? "changeUpdate"
                                              : "changeDelete",
                                    )}{" "}
                                    {counts[action]}
                                </span>
                            ))}
                    </div>
                </div>
                {undo && <UndoButton undo={undo} disabled={undoDisabled} />}
            </div>
            <details className="group border-t">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 text-muted-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                    <i
                        aria-hidden="true"
                        className="icon-[mdi--chevron-right] size-4 transition-transform group-open:rotate-90"
                    />
                    {t("changeDetails")}
                </summary>
                <div className="max-h-60 overflow-auto border-t bg-muted/40 px-4 py-3 break-all whitespace-pre-wrap text-xs font-mono">
                    <div className="mb-3 font-sans text-muted-foreground">
                        {proposal.title}
                    </div>
                    {proposal.diffs.map(({ target, before, after }) => (
                        <div key={target} className="my-2">
                            {target}
                            {before !== undefined && (
                                <div className="text-red-600">
                                    − {JSON.stringify(before, null, 2)}
                                </div>
                            )}
                            {after !== undefined && (
                                <div className="text-green-700 dark:text-green-400">
                                    + {JSON.stringify(after, null, 2)}
                                </div>
                            )}
                        </div>
                    ))}
                    {receipt?.results.map(({ target, status }) => (
                        <div key={target}>
                            {target} · {status}
                        </div>
                    ))}
                </div>
            </details>
            {decide && (
                <div className="space-y-3 border-t bg-muted/20 p-4">
                    {proposal.canRemember && (
                        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                            <input
                                type="checkbox"
                                className="mt-0.5 size-4 shrink-0 accent-primary"
                                checked={remember}
                                onChange={(event) =>
                                    setRemember(event.target.checked)
                                }
                            />
                            {t("changeRemember")}
                        </label>
                    )}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="min-h-9 rounded-lg border bg-background px-4 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                            onClick={() => decide(false)}
                        >
                            {t("changeReject")}
                        </button>
                        <button
                            type="button"
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                            onClick={() => decide(true, remember)}
                        >
                            <i
                                aria-hidden="true"
                                className="icon-[mdi--check] size-4"
                            />
                            {t("changeApprove")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function TurnChanges({
    receipts,
    undo,
    undoDisabled,
}: {
    receipts: ChangeReceipt[];
    undo?: (receipt: ChangeReceipt) => Promise<void>;
    undoDisabled?: boolean;
}) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const targets = new Set(
        receipts.flatMap((receipt) =>
            receipt.results
                .filter((item) => item.status === "applied")
                .map((item) => item.target),
        ),
    );
    const reversible = undo ? receipts.filter((receipt) => receipt.undo) : [];
    return (
        <div className="rounded-xl border bg-background text-sm">
            <div className="flex flex-wrap items-center gap-2 p-3">
                <i className="icon-[mdi--file-document-edit-outline] size-5 text-muted-foreground" />
                <span className="flex-1 font-medium">
                    {t(
                        receipts.every((receipt) => receipt.status === "undone")
                            ? "changeUndone"
                            : "changeApplied",
                    )}{" "}
                    · {targets.size} {t("changeObjects")}
                </span>
                {undo && reversible.length === 1 && (
                    <UndoButton
                        undo={() => undo(reversible[0])}
                        disabled={undoDisabled}
                    />
                )}
                <button
                    type="button"
                    aria-expanded={open}
                    className="rounded-md border px-2 py-1"
                    onClick={() => setOpen(!open)}
                >
                    {t("changeDetails")}
                </button>
            </div>
            {open && (
                <div className="space-y-2 border-t p-3">
                    {receipts.map((receipt) => (
                        <ChangeCard
                            key={receipt.proposal.id}
                            proposal={receipt.proposal}
                            receipt={receipt}
                            undo={
                                reversible.length > 1 && receipt.undo
                                    ? () => undo?.(receipt)
                                    : undefined
                            }
                            undoDisabled={undoDisabled}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function UndoButton({
    undo,
    disabled,
}: {
    undo: () => void | Promise<void>;
    disabled?: boolean;
}) {
    const { t } = useI18n();
    const [undoing, setUndoing] = useState(false);
    const label = t("changeUndo");
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted disabled:opacity-50"
            disabled={disabled || undoing}
            onClick={async () => {
                setUndoing(true);
                try {
                    await undo();
                } finally {
                    setUndoing(false);
                }
            }}
        >
            <i aria-hidden="true" className="icon-[mdi--undo-variant] size-5" />
        </button>
    );
}
