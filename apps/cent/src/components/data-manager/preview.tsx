import { getZenPostDayId } from "@glink25/zen";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { StorageAPI } from "@/api/storage";
import type { Full } from "@/database/stash";
import { useCreators } from "@/hooks/use-creator";
import PopupLayout from "@/layouts/popup-layout";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { base64ToFile } from "@/utils/file";
import type { ZenPost } from "@/zen/types";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Switch } from "../ui/switch";
import { buildMergedResolvers, PreviewBillItem } from "./preview-bill-item";

export type PreviewState = {
    bills: Full<Bill>[];
    zenPosts?: Full<ZenPost>[];
    meta?: GlobalMeta;
    strategy?: "append" | "overlap";
    asMine?: boolean;
};

function normalizeZenPosts({
    posts,
    bookId,
    userId,
    asMine,
}: {
    posts: Full<ZenPost>[];
    bookId: string;
    userId: string;
    asMine: boolean;
}) {
    const byId = new Map<string, Full<ZenPost>>();
    for (const post of posts) {
        const zenDayId = getZenPostDayId(post);
        const id = asMine ? `zen-${zenDayId}-${userId}` : post.id;
        const normalized = {
            ...post,
            id,
            time: dayjs(zenDayId).startOf("day").valueOf(),
            bookId,
            userId: asMine ? userId : post.userId,
        };
        const previous = byId.get(id);
        if (!previous || normalized.completedAt > previous.completedAt) {
            byId.set(id, normalized);
        }
    }
    return [...byId.values()];
}

export const PreviewForm = ({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: PreviewState;
    onCancel?: () => void;
    onConfirm?: (v?: PreviewState) => void;
}) => {
    const t = useIntl();
    const creators = useCreators();

    const [transformed, setTransformed] = useState<PreviewState["bills"]>([]);
    const [loading, setLoading] = useState(true);
    const [asMine, setAsMine] = useState(edit?.asMine ?? true);
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
    const [normalizedZenPosts, setNormalizedZenPosts] = useState<
        Full<ZenPost>[] | undefined
    >(edit?.zenPosts === undefined ? undefined : []);
    const [availableAppendZenPosts, setAvailableAppendZenPosts] = useState<
        Full<ZenPost>[]
    >([]);
    const [zenLoading, setZenLoading] = useState(edit?.zenPosts !== undefined);

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

    useEffect(() => {
        let cancelled = false;
        const prepareZenPosts = async () => {
            setZenLoading(edit?.zenPosts !== undefined);
            if (edit?.zenPosts === undefined) {
                setNormalizedZenPosts(undefined);
                setAvailableAppendZenPosts([]);
                return;
            }
            const bookId = useBookStore.getState().currentBookId;
            if (!bookId) return;
            const normalized = normalizeZenPosts({
                posts: edit.zenPosts,
                bookId,
                userId: String(useUserStore.getState().id),
                asMine,
            });
            if (cancelled) return;
            setNormalizedZenPosts(normalized);
            if (importStrategy === "append") {
                const existing = await StorageAPI.getAllZenItems(bookId);
                if (cancelled) return;
                const existingIds = new Set(existing.map((post) => post.id));
                setAvailableAppendZenPosts(
                    normalized.filter((post) => !existingIds.has(post.id)),
                );
            } else {
                setAvailableAppendZenPosts(normalized);
            }
        };
        void prepareZenPosts().finally(() => {
            if (!cancelled) setZenLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [asMine, edit?.zenPosts, importStrategy]);

    const availableCount =
        importStrategy === "append"
            ? availableAppend.length
            : (edit?.bills.length ?? 0);

    // 跟随 toggle 决定展示的预览列表：append 仅展示去重后的可用条目，overlap 展示全部
    const previewBills =
        importStrategy === "append" ? availableAppend : transformed;

    // 纯本地计算"假设合并后"的解析函数，绝不写入任何 store
    const resolvers = useMemo(
        () =>
            buildMergedResolvers({
                currentMeta: useLedgerStore.getState().infos?.meta,
                incomingMeta: edit?.meta,
                strategy: importStrategy,
                asMine,
                creators,
                meLabel: t("me"),
                unknownLabel: "unknown-user",
                t,
            }),
        [edit?.meta, importStrategy, asMine, creators, t],
    );

    const listRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: previewBills.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => 72,
        overscan: 5,
    });

    return (
        <PopupLayout
            title={"导入预览"}
            onBack={onCancel}
            className="h-full overflow-hidden rounded-md"
            right={
                <Button
                    disabled={loading || zenLoading}
                    onClick={() => {
                        if (importStrategy === "append") {
                            onConfirm?.({
                                bills: availableAppend,
                                zenPosts:
                                    normalizedZenPosts === undefined
                                        ? undefined
                                        : availableAppendZenPosts,
                                meta: edit?.meta,
                                strategy: "append",
                                asMine,
                            });
                        } else {
                            onConfirm?.({
                                bills: edit?.bills ?? [],
                                zenPosts: normalizedZenPosts,
                                meta: edit?.meta,
                                strategy: "overlap",
                                asMine,
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
                <div className="flex flex-col px-4 gap-3">
                    <div>
                        <div className="opacity-60 text-sm">
                            {t("put-ledgers-on-me")}
                        </div>
                        <Switch checked={asMine} onCheckedChange={setAsMine} />
                    </div>
                    {!asMine && (
                        <p className="text-xs text-red-700">
                            {t("unkown-users-may-show-up-when-analyze")}
                        </p>
                    )}
                </div>
                <div className="flex-1 flex flex-col px-4 gap-3 overflow-hidden">
                    <p className="opacity-60 text-sm">{t("preview")}:</p>

                    {normalizedZenPosts !== undefined && (
                        <p className="text-sm opacity-70">
                            {t("zen-import-preview", {
                                n:
                                    importStrategy === "append"
                                        ? availableAppendZenPosts.length
                                        : normalizedZenPosts.length,
                            })}
                        </p>
                    )}

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
                            {/* <div className="opacity-60 text-xs">
                                {t("overlap-github-tip")}
                            </div> */}
                        </div>
                    )}

                    <div
                        ref={listRef}
                        className="flex-1 overflow-auto rounded-md border divide-y"
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {rowVirtualizer
                                .getVirtualItems()
                                .map((virtualRow) => {
                                    const bill = previewBills[virtualRow.index];
                                    return (
                                        <div
                                            key={bill.id}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement}
                                            style={{
                                                position: "absolute",
                                                top: `${virtualRow.start}px`,
                                                left: 0,
                                                width: "100%",
                                            }}
                                        >
                                            <PreviewBillItem
                                                bill={bill}
                                                resolvers={resolvers}
                                                showTime
                                                showAssets
                                                className="w-full"
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
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
