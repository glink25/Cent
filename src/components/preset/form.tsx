import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import createConfirmProvider from "@/components/confirm";
import { showFilePicker } from "@/components/file-picker";
import modal from "@/components/modal";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { download } from "@/utils/download";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { PRESET_MERGE_RISK, type PresetExportSection } from "./type";
import {
    applyPreset,
    checkPresetMergeRisk,
    exportPresetWith,
    getCurrentPreset,
    parsePresetFileJson,
} from "./utils";

const FORMAT_PRESET = ".json,.cent-preset.json,application/json,text/json";

const DEFAULT_EXPORT_SECTIONS: PresetExportSection[] = [
    "tags",
    "categories",
    "customFilters",
    "customCSS",
];

function PresetExportDialogForm({
    onCancel,
    onConfirm,
}: {
    onCancel?: () => void;
    onConfirm?: (sections: PresetExportSection[]) => void;
}) {
    const t = useIntl();
    const [exportSections, setExportSections] = useState<PresetExportSection[]>(
        () => [...DEFAULT_EXPORT_SECTIONS],
    );

    const toggleExportSection = useCallback(
        (key: PresetExportSection, checked: boolean) => {
            setExportSections((prev) => {
                if (checked) {
                    return prev.includes(key) ? prev : [...prev, key];
                }
                return prev.filter((k) => k !== key);
            });
        },
        [],
    );

    const handleConfirm = useCallback(() => {
        if (exportSections.length === 0) {
            toast.warning(t("preset-export-empty-selection"));
            return;
        }
        onConfirm?.(exportSections);
    }, [exportSections, onConfirm, t]);

    return (
        <div className="w-full h-full p-4">
            <DialogHeader>
                <DialogTitle>{t("preset-export-dialog-title")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={exportSections.includes("tags")}
                        onCheckedChange={(v) =>
                            toggleExportSection("tags", v === true)
                        }
                    />
                    <span>{t("preset-export-section-tags")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={exportSections.includes("categories")}
                        onCheckedChange={(v) =>
                            toggleExportSection("categories", v === true)
                        }
                    />
                    <span>{t("preset-export-section-categories")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={exportSections.includes("customFilters")}
                        onCheckedChange={(v) =>
                            toggleExportSection("customFilters", v === true)
                        }
                    />
                    <span>{t("preset-export-section-custom-filters")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={exportSections.includes("customCSS")}
                        onCheckedChange={(v) =>
                            toggleExportSection("customCSS", v === true)
                        }
                    />
                    <span>{t("preset-export-section-custom-css")}</span>
                </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 flex justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                >
                    {t("cancel")}
                </Button>
                <Button type="button" size="sm" onClick={handleConfirm}>
                    {t("preset-export-confirm")}
                </Button>
            </DialogFooter>
        </div>
    );
}

const [PresetExportProvider, showPresetExport] = createConfirmProvider(
    PresetExportDialogForm,
    {
        dialogTitle: "preset-export",
        dialogModalClose: true,
        contentClassName: "max-w-[min(100%,420px)]",
        fade: true,
    },
);

export { PresetExportProvider, showPresetExport };

export default function PresetForm({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { id: userId } = useUserStore();
    const bookId = useBookStore((s) => s.currentBookId);
    const customCSS = useLedgerStore(
        useShallow(
            (state) => state.infos?.meta.personal?.[userId]?.customCSS ?? "",
        ),
    );

    const [cssValue, setCssValue] = useState(customCSS);

    useEffect(() => {
        setCssValue(customCSS);
    }, [customCSS]);

    const handleCssChange = useCallback((value: string) => {
        setCssValue(value);
    }, []);

    const handleSave = useCallback(async () => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            prev.customCSS = cssValue;
            return prev;
        });
        toast.success(t("custom-css-saved"));
    }, [cssValue, t]);

    const handleClear = useCallback(() => {
        setCssValue("");
    }, []);

    const runExportWithSections = useCallback(
        async (exportSections: PresetExportSection[]) => {
            const json = exportPresetWith(exportSections);
            const name = `preset-${(bookId ?? "book").replace(/\//g, "-")}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.cent-preset.json`;
            await download(
                new Blob([json], { type: "application/json" }),
                name,
            );
            toast.success(t("preset-export-done"));
        },
        [bookId, t],
    );

    const handleExport = useCallback(async () => {
        const sections = await showPresetExport();
        await runExportWithSections(sections);
    }, [runExportWithSections]);

    const runImport = useCallback(async () => {
        let files: File[];
        try {
            files = await showFilePicker({ accept: FORMAT_PRESET });
        } catch {
            return;
        }
        const file = files[0];
        if (!file) {
            return;
        }
        let incoming: ReturnType<typeof parsePresetFileJson>;
        try {
            incoming = parsePresetFileJson(await file.text());
        } catch {
            toast.error(t("preset-import-invalid"));
            return;
        }
        const current = getCurrentPreset();
        const risks = checkPresetMergeRisk(incoming, current);
        if (risks.length > 0) {
            const lines = {
                [PRESET_MERGE_RISK.TAGS_WOULD_CHANGE]: t(
                    "preset-merge-risk-tags",
                ),
                [PRESET_MERGE_RISK.TAG_GROUPS_WOULD_CHANGE]: t(
                    "preset-merge-risk-tag-groups",
                ),
                [PRESET_MERGE_RISK.CATEGORY_WOULD_CHANGE]: t(
                    "preset-merge-risk-categories",
                ),
                [PRESET_MERGE_RISK.FILTERS_WOULD_CHANGE]: t(
                    "preset-merge-risk-filters",
                ),
                [PRESET_MERGE_RISK.CSS_WOULD_CHANGE]: t(
                    "preset-merge-risk-css",
                ),
            };
            try {
                await modal.prompt({
                    title: (
                        <div className="flex flex-col gap-2 text-left text-sm font-normal">
                            <p>{t("preset-merge-risk-intro")}</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {risks.map((r) => (
                                    <li key={r}>{lines[r]}</li>
                                ))}
                            </ul>
                        </div>
                    ),
                });
            } catch {
                return;
            }
        }
        try {
            await applyPreset(incoming);
            toast.success(t("preset-import-done"));
        } catch {
            toast.error(t("preset-import-failed"));
        }
    }, [t]);

    return (
        <PopupLayout
            title={t("preset")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                <div className="px-4 pb-4">
                    <p className="text-xs opacity-60">
                        {t("preset-description")}
                    </p>
                </div>

                <div className="px-4 pb-4 flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={runImport}
                    >
                        {t("preset-import")}
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleExport}
                    >
                        {t("preset-export")}
                    </Button>
                </div>

                <PresetExportProvider />

                <div className="px-4 pb-4">
                    <div className="text-sm py-1">{t("theme-market")}</div>
                    <div className="w-full border rounded-md p-4 flex flex-col items-center justify-center gap-2 bg-muted/30">
                        <i className="icon-[mdi--store-outline] size-8 opacity-40"></i>
                        <div className="text-sm opacity-60 text-center">
                            {t("theme-market-coming-soon")}
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-4">
                    <div className="text-sm py-1">{t("custom-css")}</div>
                    <div className="pb-2">
                        <div className="text-xs opacity-60 mb-2">
                            {t("custom-css-description")}
                        </div>
                        <textarea
                            placeholder={t("custom-css-placeholder")}
                            className="w-full border rounded-md p-3 h-40 resize-none text-sm font-mono"
                            value={cssValue}
                            onChange={(e) => {
                                handleCssChange(e.currentTarget.value);
                            }}
                        ></textarea>
                        <div className="flex gap-2 mt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClear}
                                className="flex-1"
                            >
                                {t("clear")}
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSave}
                                className="flex-1"
                            >
                                {t("save")}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </PopupLayout>
    );
}
