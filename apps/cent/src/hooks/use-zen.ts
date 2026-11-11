import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { PersonalMeta } from "@/ledger/extra-type";
import { measure } from "@/measurement";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import {
    getZenDayId,
    getZenStyleName,
    isZenEntranceOpen,
    showZenDialog,
} from "@/zen";
import { readZenPost } from "@/zen/storage";

const EMPTY_AI_CONFIGS: NonNullable<
    NonNullable<PersonalMeta["assistant"]>["configs"]
> = [];

const zenMeasurementState = { ready: false };

export function useZen() {
    const userId = useUserStore((state) => state.id);
    const {
        zen,
        configs: storedConfigs,
        defaultConfigId,
    } = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[userId];
            return {
                zen: personal?.zen,
                configs: personal?.assistant?.configs,
                defaultConfigId: personal?.assistant?.defaultConfigId,
            };
        }),
    );
    const configs = storedConfigs ?? EMPTY_AI_CONFIGS;
    const updateSettings = useCallback(
        (value: NonNullable<PersonalMeta["zen"]>) =>
            useLedgerStore.getState().updatePersonalMeta((prev) => ({
                ...prev,
                zen: { ...prev.zen, ...value },
            })),
        [],
    );
    return {
        settings: zen,
        configs,
        defaultConfigId,
        updateSettings,
    };
}

export function useZenOverview() {
    const { settings } = useZen();
    const bookId = useBookStore((state) => state.currentBookId);
    const userId = String(useUserStore((state) => state.id));
    const [now, setNow] = useState(dayjs());
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(dayjs()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    const enabled = Boolean(settings?.enabled);
    const dayId = getZenDayId(now);
    const key = JSON.stringify([bookId, userId, dayId]);
    const [availability, setAvailability] = useState<{
        key: string;
        hasPost: boolean;
    }>();
    useEffect(() => {
        if (!enabled || !bookId) return;
        let active = true;
        let revision = 0;
        let unsubscribe: (() => void) | undefined;
        const refresh = async () => {
            const current = ++revision;
            const post = await readZenPost(bookId, userId, dayId);
            if (active && current === revision)
                setAvailability({ key, hasPost: Boolean(post) });
        };
        void loadStorageAPI()
            .then(({ StorageAPI }) => {
                if (!active) return;
                unsubscribe = StorageAPI.onZenChange(({ bookId: changed }) => {
                    if (changed === bookId) void refresh().catch(() => {});
                });
                return refresh();
            })
            .catch(() => {});
        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [bookId, dayId, enabled, key, userId]);
    const ready =
        enabled &&
        availability?.key === key &&
        !availability.hasPost &&
        isZenEntranceOpen(settings?.scheduledTime, now);
    zenMeasurementState.ready = ready;
    const styleName = getZenStyleName(now);
    const open = useCallback(() => {
        measure("zen_opened", {
            state: zenMeasurementState.ready ? "ready" : "manual",
        });
        setIsOpen(true);
        void showZenDialog()
            .catch(() => {})
            .finally(() => setIsOpen(false));
    }, []);

    return { dayId, enabled, ready, styleName, isOpen, open };
}
