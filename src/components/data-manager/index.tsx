import { cloneDeep, merge } from "lodash-es";
import { StorageAPI, StorageDeferredAPI } from "@/api/storage";
import type { MetaUpdate, Update } from "@/database/stash";
import PopupLayout from "@/layouts/popup-layout";
import type { Bill, ExportedJSON, GlobalMeta } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { download } from "@/utils/download";
import createConfirmProvider from "../confirm";
import { FORMAT_BACKUP, showFilePicker } from "../file-picker";
import modal from "../modal";
import { Button } from "../ui/button";
import { showOncentImport } from "./oncent";
import {
    ImportPreviewProvider,
    importFromPreviewResult,
    showImportPreview,
} from "./preview";
import { SmartImportProvider, showSmartImport } from "./smart-import";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const toImport = async () => {
        const bookid = useBookStore.getState().currentBookId;
        if (!bookid) {
            return;
        }
        const [jsonFile] = await showFilePicker({ accept: FORMAT_BACKUP });
        const jsonText = await jsonFile.text();
        const data = JSON.parse(jsonText) as ExportedJSON;
        const res = await showImportPreview({
            bills: data.items,
            meta: data.meta,
        });
        if (!res) {
            return;
        }
        await importFromPreviewResult(res);
    };

    const toExport = async () => {
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) {
            return;
        }
        const [stopLoading] = modal.loading();
        const buffer = await StorageDeferredAPI.exportToArrayBuffer(bookId);
        const uint8 = new Uint8Array(buffer);
        const blob = new Blob([uint8], { type: "application/json" });
        await download(
            blob,
            `cent-backup-${bookId.replace("/", "-")}-${new Date().toISOString()}.json`,
        );
        stopLoading();
    };

    const toImportFromOncent = async () => {
        const [jsonFile] = await showFilePicker({ accept: FORMAT_BACKUP });
        const jsonText = await jsonFile.text();
        const data = JSON.parse(jsonText);
        await showOncentImport(data);
    };
    return (
        <PopupLayout
            title={
                <div className="relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]">
                    {t("data-manager")}
                </div>
            }
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="w-full h-[450px] flex flex-col justify-center items-center rounded">
                <div className="flex-1 flex flex-col w-full gap-2 h-full overflow-hidden">
                    <div className="px-4 opacity-60 text-sm">{t("backup")}</div>
                    <div className="flex flex-col px-4 gap-2">
                        <Button
                            variant="outline"
                            className="py-4"
                            onClick={toImport}
                        >
                            {t("data-import")}
                        </Button>
                        <Button
                            variant="outline"
                            className="py-4"
                            onClick={toExport}
                        >
                            {t("data-export")}
                        </Button>
                    </div>
                    <div className="px-4 opacity-60 text-sm">{t("others")}</div>
                    <div className="flex flex-col px-4 gap-2">
                        <Button
                            variant="outline"
                            className="py-4"
                            onClick={toImportFromOncent}
                        >
                            {t("import-from-oncent-github-io")}
                        </Button>
                    </div>
                    <div className="flex flex-col px-4 gap-2">
                        <Button
                            variant="outline"
                            className="py-4"
                            onClick={showSmartImport}
                        >
                            {t("smart-import")}
                        </Button>
                    </div>
                </div>
            </div>
            <ImportPreviewProvider />
            <SmartImportProvider />
        </PopupLayout>
    );
}

const [DataManagerProvider, showDataManager] = createConfirmProvider(Form, {
    dialogTitle: "data-manager",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function DataManagerSettingsItem() {
    const t = useIntl();
    return (
        <div className="lab">
            <Button
                onClick={() => {
                    showDataManager();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--database-outline] size-5"></i>
                        <div className="relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]">
                            {t("data-manager")}
                        </div>
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <DataManagerProvider />
        </div>
    );
}
