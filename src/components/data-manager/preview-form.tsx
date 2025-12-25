import { cloneDeep, isEqual, merge } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import { StorageAPI } from "@/api/storage";
import type { Full, MetaUpdate, Update } from "@/database/stash";
import PopupLayout from "@/layouts/popup-layout";
import { BillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { appendCategories } from "@/ledger/utils";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import createConfirmProvider from "../confirm";
import { PreviewForm, type PreviewState } from "./preview";

export const [ImportPreviewProvider, showImportPreview] = createConfirmProvider(
    PreviewForm,
    {
        dialogTitle: "experimental-functions",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);

export const importFromPreviewResult = async (res: PreviewState) => {
    const { strategy, asMine, ...rest } = res;
    const currentMeta = cloneDeep(
        useLedgerStore.getState().infos?.meta ?? ({} as GlobalMeta),
    );
    const newMeta =
        strategy === "overlap"
            ? rest.meta
            : (() => {
                  if (!rest.meta?.categories) {
                      const merged = merge(currentMeta, rest.meta);
                      return merged;
                  }
                  const currentCategories =
                      (currentMeta.categories?.length ?? 0) === 0
                          ? BillCategories
                          : currentMeta.categories!;
                  const incomingCategories = [...(rest.meta?.categories ?? [])];
                  // 必须用深拷贝否则会被merge改变
                  const appended = cloneDeep(
                      appendCategories(currentCategories, incomingCategories),
                  );
                  const merged = merge(currentMeta, rest.meta);
                  if (isEqual(BillCategories, appended)) {
                      merged.categories = undefined;
                  } else {
                      merged.categories = appended;
                  }
                  return merged;
              })();
    const bookId = useBookStore.getState().currentBookId;
    if (!bookId) {
        return;
    }
    const mineId = useUserStore.getState().id;
    await StorageAPI.batch(
        bookId,
        [
            ...rest.bills.map((v) => {
                return {
                    id: v.id,
                    type: "update",
                    value: { ...v, creatorId: asMine ? mineId : v.creatorId },
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
