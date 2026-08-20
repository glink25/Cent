import { useEffect } from "react";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { BillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta, PersonalMeta } from "@/ledger/type";
import { isMeasurementReady, measure } from "@/measurement";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import type { MeasurementEventMap, UsageMetric } from "../measurement";

export const USAGE_SNAPSHOT_STORAGE_KEY = "cent-measurement-usage-snapshot";
const DEFAULT_FILTER_VIEW_ID = "default-filter-view";

type UsageSnapshotMetric = MeasurementEventMap["usage_snapshot_metric"];

type ThrottleState = {
    date: string;
    accountMetricsSent: boolean;
    bookDigests: string[];
};

type SnapshotInput = {
    bookCount: number;
    meta: GlobalMeta;
    personal: PersonalMeta;
    bills: Pick<Bill, "images">[];
    collaboratorCount?: number;
    includeBookCount: boolean;
};

const inFlightBooks = new Set<string>();

function normalizeCount(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function bucketSmall(
    value: number,
): Pick<UsageSnapshotMetric, "bucket" | "approx_value"> {
    const count = normalizeCount(value);
    if (count === 0) return { bucket: "0", approx_value: 0 };
    if (count === 1) return { bucket: "1", approx_value: 1 };
    if (count <= 3) return { bucket: "2_3", approx_value: 2.5 };
    if (count <= 10) return { bucket: "4_10", approx_value: 7 };
    return { bucket: "11_plus", approx_value: 15 };
}

export function bucketMedium(
    value: number,
): Pick<UsageSnapshotMetric, "bucket" | "approx_value"> {
    const count = normalizeCount(value);
    if (count === 0) return { bucket: "0", approx_value: 0 };
    if (count <= 3) return { bucket: "1_3", approx_value: 2 };
    if (count <= 10) return { bucket: "4_10", approx_value: 7 };
    if (count <= 30) return { bucket: "11_30", approx_value: 20 };
    return { bucket: "31_plus", approx_value: 40 };
}

export function bucketBills(
    value: number,
): Pick<UsageSnapshotMetric, "bucket" | "approx_value"> {
    const count = normalizeCount(value);
    if (count === 0) return { bucket: "0", approx_value: 0 };
    if (count <= 10) return { bucket: "1_10", approx_value: 5 };
    if (count <= 50) return { bucket: "11_50", approx_value: 30 };
    if (count <= 200) return { bucket: "51_200", approx_value: 125 };
    if (count <= 1000) return { bucket: "201_1000", approx_value: 600 };
    if (count <= 5000) return { bucket: "1001_5000", approx_value: 3000 };
    return { bucket: "5001_plus", approx_value: 7500 };
}

export function bucketAttachments(
    value: number,
): Pick<UsageSnapshotMetric, "bucket" | "approx_value"> {
    const count = normalizeCount(value);
    if (count === 0) return { bucket: "0", approx_value: 0 };
    if (count === 1) return { bucket: "1", approx_value: 1 };
    if (count <= 5) return { bucket: "2_5", approx_value: 3.5 };
    if (count <= 20) return { bucket: "6_20", approx_value: 13 };
    if (count <= 100) return { bucket: "21_100", approx_value: 60 };
    return { bucket: "101_plus", approx_value: 150 };
}

export function bucketBoolean(
    enabled: boolean,
): Pick<UsageSnapshotMetric, "bucket" | "approx_value"> {
    return enabled
        ? { bucket: "enabled", approx_value: 1 }
        : { bucket: "disabled", approx_value: 0 };
}

function metric(
    name: UsageMetric,
    value: number,
    bucket: (
        value: number,
    ) => Pick<UsageSnapshotMetric, "bucket" | "approx_value">,
): UsageSnapshotMetric {
    return { metric: name, ...bucket(value) };
}

function booleanMetric(
    name: UsageMetric,
    enabled: boolean,
): UsageSnapshotMetric {
    return { metric: name, ...bucketBoolean(enabled) };
}

export function buildUsageSnapshotMetrics({
    bookCount,
    meta,
    personal,
    bills,
    collaboratorCount,
    includeBookCount,
}: SnapshotInput): UsageSnapshotMetric[] {
    const defaultCategoryIds = new Set(
        BillCategories.map((category) => category.id),
    );
    const categories = meta.categories ?? BillCategories;
    const customCategoryCount = categories.filter(
        (category) => !defaultCategoryIds.has(category.id),
    ).length;
    const renamedCategoryCount = categories.filter(
        (category) =>
            defaultCategoryIds.has(category.id) && category.customName === true,
    ).length;
    const attachmentCount = bills.reduce(
        (total, bill) => total + (bill.images?.length ?? 0),
        0,
    );
    const scheduleds = personal.scheduleds ?? [];
    const result: UsageSnapshotMetric[] = [];

    if (includeBookCount) {
        result.push(metric("book_count", bookCount, bucketSmall));
    }
    result.push(
        booleanMetric(
            "custom_theme_enabled",
            Boolean(personal.customCSS?.trim()),
        ),
        metric("widget_count", meta.widgets?.length ?? 0, bucketSmall),
        metric(
            "home_widget_count",
            personal.homeWidgets?.length ?? 0,
            bucketSmall,
        ),
    );
    if (collaboratorCount !== undefined) {
        result.push(
            metric("collaborator_count", collaboratorCount, bucketSmall),
        );
    }
    result.push(
        metric("custom_category_count", customCategoryCount, bucketSmall),
        metric("renamed_category_count", renamedCategoryCount, bucketSmall),
        metric("tag_count", meta.tags?.length ?? 0, bucketMedium),
        metric("tag_group_count", personal.tagGroups?.length ?? 0, bucketSmall),
        metric(
            "custom_currency_count",
            meta.customCurrencies?.length ?? 0,
            bucketSmall,
        ),
        metric("budget_count", meta.budgets?.length ?? 0, bucketSmall),
        metric("scheduled_count", scheduleds.length, bucketSmall),
        metric(
            "enabled_scheduled_count",
            scheduleds.filter((scheduled) => scheduled.enabled).length,
            bucketSmall,
        ),
        booleanMetric(
            "map_enabled",
            Boolean(meta.map?.amapKey && meta.map?.amapSecurityCode),
        ),
        metric(
            "stat_filter_count",
            (meta.customFilters ?? []).filter(
                (filter) => filter.id !== DEFAULT_FILTER_VIEW_ID,
            ).length,
            bucketSmall,
        ),
        metric("bill_count", bills.length, bucketBills),
        metric("attachment_count", attachmentCount, bucketAttachments),
    );
    return result;
}

function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function emptyThrottleState(date: string): ThrottleState {
    return { date, accountMetricsSent: false, bookDigests: [] };
}

export function readThrottleState(date = localDate()): ThrottleState {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(USAGE_SNAPSHOT_STORAGE_KEY) ?? "null",
        ) as Partial<ThrottleState> | null;
        if (parsed?.date !== date) return emptyThrottleState(date);
        return {
            date,
            accountMetricsSent: parsed.accountMetricsSent === true,
            bookDigests: Array.isArray(parsed.bookDigests)
                ? parsed.bookDigests.filter(
                      (value): value is string => typeof value === "string",
                  )
                : [],
        };
    } catch {
        return emptyThrottleState(date);
    }
}

export async function hashBookId(bookId: string) {
    const data = new TextEncoder().encode(bookId);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
}

export async function sendUsageSnapshot(
    bookId: string,
    bookCount: number,
    meta: GlobalMeta,
    userId: string | number,
) {
    if (!isMeasurementReady()) return;
    if (inFlightBooks.has(bookId)) return;
    inFlightBooks.add(bookId);
    try {
        const digest = await hashBookId(bookId);
        const date = localDate();
        const throttle = readThrottleState(date);
        if (throttle.bookDigests.includes(digest)) return;

        const { StorageDeferredAPI } = await loadStorageAPI();
        const bills = await StorageDeferredAPI.filter(bookId, {});
        const creators = useLedgerStore.getState().infos?.creators;
        const collaboratorCount = creators
            ? creators.filter(
                  (creator) => String(creator.id) !== String(userId),
              ).length
            : undefined;
        const personal = meta.personal?.[userId] ?? {};
        const metrics = buildUsageSnapshotMetrics({
            bookCount,
            meta,
            personal,
            bills,
            collaboratorCount,
            includeBookCount: !throttle.accountMetricsSent,
        });
        if (!isMeasurementReady()) return;
        for (const parameters of metrics) {
            measure("usage_snapshot_metric", parameters);
        }
        localStorage.setItem(
            USAGE_SNAPSHOT_STORAGE_KEY,
            JSON.stringify({
                date,
                accountMetricsSent: true,
                bookDigests: [...throttle.bookDigests, digest],
            } satisfies ThrottleState),
        );
    } catch {
        // A failed snapshot is deliberately left unmarked so a later visit can retry.
    } finally {
        inFlightBooks.delete(bookId);
    }
}

export function useMeasurementUsageSnapshot() {
    const currentBookId = useBookStore((state) => state.currentBookId);
    const books = useBookStore((state) => state.books);
    const booksLoading = useBookStore((state) => state.loading);
    const infos = useLedgerStore((state) => state.infos);
    const ledgerLoading = useLedgerStore((state) => state.loading);
    const userId = useUserStore((state) => state.id);

    useEffect(() => {
        if (
            !isMeasurementReady() ||
            !currentBookId ||
            !userId ||
            !infos ||
            booksLoading ||
            ledgerLoading ||
            !books.some((book) => book.id === currentBookId)
        ) {
            return;
        }

        const run = () => {
            void sendUsageSnapshot(
                currentBookId,
                books.length,
                infos.meta,
                userId,
            );
        };
        if (typeof window.requestIdleCallback === "function") {
            const id = window.requestIdleCallback(run);
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(run, 0);
        return () => window.clearTimeout(id);
    }, [books, booksLoading, currentBookId, infos, ledgerLoading, userId]);
}
