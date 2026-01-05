import dayjs from "dayjs";
import {
    calcNextDate,
    fillScheduledBills,
    useScheduled,
} from "@/hooks/use-scheduled";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { showScheduledEdit } from ".";

const toDay = (v: number) => dayjs.unix(v / 1000).format("YYYY-MM-DD");

export default function ScheduledListForm({
    onCancel,
}: {
    onCancel?: () => void;
}) {
    const t = useIntl();
    const { scheduleds, add, update } = useScheduled();

    return (
        <PopupLayout onBack={onCancel} title={t("scheduled-manager")}>
            <div className="flex items-center justify-between px-2">
                <div className="px-2 text-xs text-foreground/80">
                    {t("scheduled-description")}
                </div>
            </div>
            <div className="w-full flex-1 overflow-y-auto flex flex-col gap-2 p-2">
                <Button
                    variant="outline"
                    onClick={async () => {
                        const newOne = await showScheduledEdit();
                        if (!newOne) return;
                        const needBills = [...(newOne.needBills ?? [])];
                        delete newOne.needBills;
                        useLedgerStore.getState().addBills(needBills);
                        await add(newOne);
                    }}
                >
                    <i className="icon-[mdi--add]" />
                    {t("add-a-scheduled")}
                </Button>

                {scheduleds.map((s) => {
                    const next = calcNextDate(
                        s.repeat.value,
                        s.repeat.unit,
                        Date.now(),
                        s.start,
                        s.end,
                    );
                    return (
                        <div
                            key={s.id}
                            className="border rounded-md shadow-sm py-2 px-4 bg-default flex items-center gap-2"
                        >
                            <div className="flex-1 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{s.title}</div>
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-xs text-foreground/70 mt-1 flex items-center gap-2">
                                        <div>{toDay(s.start)}</div>
                                        {s.end && (
                                            <>
                                                <div>-</div>
                                                <div>{toDay(s.end)}</div>
                                            </>
                                        )}
                                    </div>
                                    {next && (
                                        <div className="text-xs text-foreground/70">
                                            {t("next-schedule-date-at", {
                                                date: toDay(next),
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-foreground/70">
                                    <Switch
                                        checked={Boolean(s.enabled)}
                                        onCheckedChange={async (v) => {
                                            if (v) {
                                                const needBills =
                                                    await fillScheduledBills(s);
                                                if (needBills.length > 0) {
                                                    const ok = confirm(
                                                        t(
                                                            "scheduled-lack-bills",
                                                            {
                                                                n: needBills.length,
                                                            },
                                                        ),
                                                    );
                                                    if (ok) {
                                                        useLedgerStore
                                                            .getState()
                                                            .addBills(
                                                                needBills,
                                                            );
                                                    }
                                                }
                                            }
                                            await update(s.id, {
                                                ...s,
                                                enabled: !!v,
                                                latest: Date.now() + 1,
                                            });
                                        }}
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-[24px] h-[24px] text-xs p-0"
                                    onClick={async () => {
                                        const id = s.id;
                                        const newOne =
                                            await showScheduledEdit(s);
                                        if (!newOne) return;
                                        const needBills = [
                                            ...(newOne.needBills ?? []),
                                        ];
                                        delete newOne.needBills;
                                        useLedgerStore
                                            .getState()
                                            .addBills(needBills);
                                        await update(id, newOne);
                                    }}
                                >
                                    <i className="icon-[mdi--edit-outline]" />
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-[24px] h-[24px] p-0"
                                    onClick={async () => {
                                        const ok = confirm(
                                            t("scheduled-delete-warning"),
                                        );
                                        if (!ok) return;
                                        await update(s.id, undefined);
                                    }}
                                >
                                    <i className="icon-[mdi--delete]" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </PopupLayout>
    );
}
