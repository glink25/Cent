import { cloneDeep, merge } from "lodash-es";
import {
    type ExportedJSON,
    type GlobalMeta,
    StorageAPI,
    StorageDeferredAPI,
} from "@/api/storage";
import type { MetaUpdate, Update } from "@/gitray";
import PopupLayout from "@/layouts/popup-layout";
import { BillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { download } from "@/utils/download";
import createConfirmProvider from "../confirm";
import { FORMAT_BACKUP, showFilePicker } from "../file-picker";
import modal from "../modal";
import { Button } from "../ui/button";
import { showOncentImport } from "./oncent";
import { ImportPreviewProvider, showImportPreview } from "./preview";

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
        const { strategy, ...rest } = res;
        const currentMeta = cloneDeep(
            useLedgerStore.getState().infos?.meta ?? ({} as GlobalMeta),
        );
        const newMeta =
            strategy === "overlap"
                ? rest.meta
                : (() => {
                      // 相同名称或者id的category将合并为同一个
                      const curm = currentMeta;
                      curm.categories = undefined;
                      const newm = { ...rest.meta };
                      const merged = merge(curm, newm);
                      if (!rest.meta?.categories) {
                          merged.categories = currentMeta.categories;
                          return merged;
                      }
                      const newCategories = [...(currentMeta.categories ?? [])];
                      rest.meta.categories.forEach((c) => {
                          const sameIdIndex = newCategories?.findIndex(
                              (x) => x.id === c.id,
                          );
                          if (sameIdIndex !== -1) {
                              const old = newCategories[sameIdIndex];
                              newCategories[sameIdIndex] = { ...c };
                              newCategories[sameIdIndex].id = old.id;
                          } else {
                              newCategories.push(c);
                          }
                      });
                      merged.categories = newCategories;
                      return merged;
                  })();
        await StorageAPI.batch(
            bookid,
            [
                ...rest.bills.map((v) => {
                    return {
                        id: v.id,
                        type: "update",
                        value: { ...v },
                        timestamp: v.__update_at,
                    } as Update<Bill>;
                }),
                {
                    type: "meta",
                    metaValue: newMeta,
                } as MetaUpdate,
            ],
            strategy === "overlap",
        );
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
                </div>
            </div>
            <ImportPreviewProvider />
        </PopupLayout>
    );
}

const [DataManagerProvider, showDataManager] = createConfirmProvider(Form, {
    dialogTitle: "data-manager",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
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
