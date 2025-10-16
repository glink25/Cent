import { useEffect, useRef, useState } from "react";
import type { GlobalMeta } from "@/api/storage";
import type { Full } from "@/gitray";
import PopupLayout from "@/layouts/popup-layout";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { base64ToFile } from "@/utils/file";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

type PreviewState = {
    bills: Full<Bill>[];
    meta?: GlobalMeta;
    strategy?: "append" | "overlap";
};

const PreviewForm = ({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: PreviewState;
    onCancel?: () => void;
    onConfirm?: (v?: PreviewState) => void;
}) => {
    const t = useIntl();

    const [transformed, setTransformed] = useState<PreviewState["bills"]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const transform = async () => {
            return await (edit?.bills
                ? Promise.all(
                      edit.bills.map(async (b) => {
                          const images = b.images
                              ? await Promise.all(
                                    b.images?.map((img) => {
                                        if (img instanceof File) {
                                            return img;
                                        }
                                        if (img.startsWith("data:")) {
                                            return base64ToFile(img);
                                        }
                                        return img;
                                    }),
                                )
                              : undefined;
                          return { ...b, images };
                      }),
                  )
                : []);
        };
        transform()
            .then((v) => {
                setTransformed(v);
            })
            .catch(console.error)
            .finally(() => {
                setLoading(false);
            });
    }, [edit?.bills]);

    const [importStrategy, setImportStrategy] = useState<"append" | "overlap">(
        "append",
    );
    const [availableAppend, setAvailableAppend] = useState<
        PreviewState["bills"]
    >([]);

    useEffect(() => {
        const getAvailableAppend = async () => {
            const imported = transformed;
            const exist = await useLedgerStore.getState().refreshBillList();
            const available = imported?.filter((b) => {
                return exist.every((e) => e.id !== b.id && e.time !== b.time);
            });
            return available ?? [];
        };
        if (importStrategy === "append")
            getAvailableAppend().then((v) => {
                setAvailableAppend(v);
            });
    }, [transformed, importStrategy]);

    const availableCount =
        importStrategy === "append"
            ? availableAppend.length
            : (edit?.bills.length ?? 0);
    return (
        <PopupLayout
            title={"导入预览"}
            onBack={onCancel}
            className="h-full overflow-hidden rounded-md"
            right={
                <Button
                    disabled={loading || availableCount <= 0}
                    onClick={() => {
                        if (importStrategy === "append") {
                            onConfirm?.({
                                bills: availableAppend,
                                meta: edit?.meta,
                                strategy: "append",
                            });
                        } else {
                            onConfirm?.({
                                bills: edit?.bills ?? [],
                                meta: edit?.meta,
                                strategy: "overlap",
                            });
                        }
                    }}
                >
                    {t("confirm")}
                </Button>
            }
        >
            <div className="relative flex-1 flex flex-col w-full gap-2 overflow-hidden">
                <div className="flex flex-col px-4 gap-3">
                    <div className="opacity-60 text-sm">
                        {t("import-strategy")}:
                        <span>{`${t("import-description")}`}</span>
                    </div>
                    <RadioGroup
                        value={importStrategy}
                        className="flex flex-col gap-2"
                        onValueChange={(v) =>
                            setImportStrategy(
                                v === "append" ? "append" : "overlap",
                            )
                        }
                    >
                        <Label className="flex gap-2">
                            <RadioGroupItem value="append" />
                            {t("strategy-add")}
                        </Label>
                        <Label className="flex gap-2">
                            <RadioGroupItem value="overlap" />
                            {t("strategy-overlap")}
                        </Label>
                    </RadioGroup>
                </div>
                <div className="flex-1 flex flex-col px-4 gap-3 overflow-hidden">
                    <p className="opacity-60 text-sm">{t("preview")}:</p>

                    {importStrategy === "append" ? (
                        <div>
                            {t("append-preview-description", {
                                n: (
                                    <span className="text-green-700">
                                        {availableCount}
                                    </span>
                                ),
                            })}
                        </div>
                    ) : (
                        <div>
                            <div className="text-red-700">
                                {t("overlap-preview-description", {
                                    n: (
                                        <span className="text-red-700">
                                            {availableCount}
                                        </span>
                                    ),
                                })}
                            </div>
                            <div className="opacity-60 text-xs">
                                {t("overlap-github-tip")}
                            </div>
                        </div>
                    )}
                </div>
                {loading && (
                    <div className="absolute top-0 left-0 w-full h-full bg-background/60 flex items-center justify-center">
                        <i className="icon-[mdi--loading] animate-spin"></i>
                    </div>
                )}
            </div>
        </PopupLayout>
    );
};

export const [ImportPreviewProvider, showImportPreview] = createConfirmProvider(
    PreviewForm,
    {
        dialogTitle: "experimental-functions",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
    },
);
