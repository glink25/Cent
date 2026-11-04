import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORMAT_IMAGE_SUPPORTED } from "@/components/file-picker";
import { useTheme } from "@/hooks/use-theme";
import { useWidgetMeta } from "@/hooks/use-widget-meta";
import type { Bill } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { attachmentRef, resolveAttachments } from "./core/attachments";
import compileWidget from "./core/compile";
import {
    insertComputed,
    isComputedEntry,
    validateComputed,
} from "./core/computed";
import { widgetData, widgetHost } from "./core/host";
import { reconcileNode } from "./core/reconcile";
import runWidget from "./core/runner";
import { jsonObject, validateEdit } from "./core/validation";
import WidgetModal from "./modal";
import type { DSLNode, Widget } from "./type";
import WidgetRenderer from "./widget";

type Session = {
    id: string;
    view: string;
    params: Record<string, unknown>;
    state: Record<string, unknown>;
    title?: string;
    dsl?: DSLNode;
    renderError?: string;
    attachmentSources?: Map<string, NonNullable<Bill["images"]>>;
    attachmentRepo?: string;
    attachmentViewer?: string | number;
    canPickFiles?: boolean;
};
function session(view = "default", params = {}, title?: string): Session {
    return { id: crypto.randomUUID(), view, params, title, state: {} };
}
function eventIds(node?: DSLNode): string[] {
    return node
        ? [
              ...Object.values(node.events ?? {}).filter(
                  (v): v is string => !!v,
              ),
              ...node.children.flatMap(eventIds),
          ]
        : [];
}

export default function InteractiveWidget({
    widget,
    className,
    preview = false,
    initialView = "default",
    bills,
}: {
    widget: Widget;
    className?: string;
    preview?: boolean;
    initialView?: string;
    bills?: Bill[];
}) {
    const [sessions, setSessions] = useState<Session[]>(() => [
        session(initialView),
    ]);
    const current = useRef(sessions);
    const [closing, setClosing] = useState<Session[]>([]);
    const modalControllers = useRef(new Map<string, () => void>());
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState<string>();
    const refreshPending = useRef(false);
    const processing = useRef(false);
    const pendingTaps = useRef(new Set<string>());
    const active = useRef(true);
    const epoch = useRef(0);
    const queue = useRef(Promise.resolve());
    const simulated = useRef<{
        storage: Record<string, unknown>;
        bills?: Bill[];
    }>({ storage: structuredClone(widget.storage ?? {}) });
    const { customCurrencies: effectiveCurrencies } = useWidgetMeta();
    const info = useLedgerStore((s) => s.infos);
    const changes = useLedgerStore((s) => s.bills);
    const viewer = useUserStore((s) => s.id);
    const repo = useBookStore((s) => s.currentBookId);
    const declared = useMemo(
        () => compileWidget(widget.code).permissions,
        [widget.code],
    );
    const files = useMemo(
        () => ({
            repo,
            viewer,
            code: widget.code,
            sessions: new Map<string, Map<string, Map<string, File>>>(),
        }),
        [repo, viewer, widget.code],
    ).sessions;
    const resolveFile = useCallback(
        (sessionId: string, ref: string) => {
            for (const selection of files.get(sessionId)?.values() ?? []) {
                const file = selection.get(ref);
                if (file) return file;
            }
        },
        [files],
    );
    const { theme } = useTheme();
    const registerModal = useCallback((id: string, cancel: () => void) => {
        modalControllers.current.set(id, cancel);
    }, []);
    const dismissModal = useCallback((id: string) => {
        modalControllers.current.delete(id);
        const entry = current.current.find((session) => session.id === id);
        if (!entry) return;
        setClosing((previous) => [...previous, entry]);
        current.current = current.current.filter(
            (session) => session.id !== id,
        );
        setSessions(current.current);
        setError(undefined);
    }, []);
    const removeModal = useCallback((id: string) => {
        setClosing((previous) =>
            previous.filter((session) => session.id !== id),
        );
    }, []);
    const options = useCallback(
        async (target: Session) => {
            const data = await widgetData();
            data.customCurrencies = effectiveCurrencies;
            if (preview) {
                const computed = await runWidget(widget.code, {
                    settings: widget.settings,
                    grants: widget.permissions,
                    getData: async () => ({
                        ...data,
                        bills: [],
                        customCurrencies: data.customCurrencies.filter(
                            (currency) => !isComputedEntry(currency),
                        ),
                    }),
                    runtime: {
                        widgetId: widget.id,
                        viewer: { id: viewer },
                        storage: simulated.current.storage,
                        mode: "computed",
                    },
                });
                if (computed.success)
                    data.customCurrencies = insertComputed(
                        data.customCurrencies.filter(
                            (currency) =>
                                !isComputedEntry(currency) ||
                                currency.widgetId !== widget.id,
                        ),
                        validateComputed(computed.result, widget.id)
                            .customCurrencies,
                    );
            }
            const installed = preview
                ? widget
                : data.widgets?.find((w) => w.id === widget.id);
            if (!installed || installed.code !== widget.code)
                throw new Error("Widget was changed or removed");
            if (preview && !simulated.current.bills)
                simulated.current.bills = structuredClone(data.bills);
            return {
                settings: widget.settings,
                grants: installed.permissions,
                env: {
                    theme: (theme === "dark" ||
                    (theme === "system" &&
                        matchMedia("(prefers-color-scheme: dark)").matches)
                        ? "dark"
                        : "light") as "dark" | "light",
                },
                getData: async () => ({
                    ...data,
                    bills: preview ? simulated.current.bills! : data.bills,
                    filter: bills ? { billIds: bills.map((b) => b.id) } : {},
                }),
                runtime: {
                    widgetId: widget.id,
                    viewer: { id: viewer },
                    storage: preview
                        ? simulated.current.storage
                        : installed.storage,
                    view: target.view,
                    params: target.params,
                    state: target.state,
                },
            };
        },
        [widget, viewer, theme, preview, bills, effectiveCurrencies],
    );
    const refresh = useCallback(
        async (targetId?: string) => {
            const version = ++epoch.current;
            try {
                const rendered = await Promise.all(
                    current.current.map(async (target) => {
                        if (targetId && target.id !== targetId && target.dsl)
                            return target;
                        try {
                            const snapshot = await options(target);
                            const result = await runWidget(
                                widget.code,
                                snapshot,
                            );
                            if (!result.success) throw new Error(result.error);
                            const { dsl, state } = result.result as {
                                dsl: DSLNode;
                                state: Record<string, unknown>;
                            };
                            return {
                                ...target,
                                dsl: reconcileNode(target.dsl, dsl),
                                state,
                                renderError: undefined,
                                canPickFiles:
                                    declared.includes("edit") &&
                                    snapshot.grants.includes("edit"),
                                attachmentRepo: repo,
                                attachmentViewer: viewer,
                                attachmentSources:
                                    declared.includes("billing") &&
                                    snapshot.grants.includes("billing")
                                        ? new Map(
                                              (
                                                  await snapshot.getData()
                                              ).bills.flatMap((bill) =>
                                                  bill.images?.length
                                                      ? ([
                                                            [
                                                                bill.id,
                                                                bill.images,
                                                            ],
                                                        ] as const)
                                                      : [],
                                              ),
                                          )
                                        : undefined,
                            };
                        } catch (error) {
                            return { ...target, renderError: String(error) };
                        }
                    }),
                );
                if (active.current && version === epoch.current) {
                    const liveIds = new Set(
                        current.current.map((entry) => entry.id),
                    );
                    current.current = rendered.filter((entry) =>
                        liveIds.has(entry.id),
                    );
                    setSessions(current.current);
                }
            } catch (e) {
                if (active.current && version === epoch.current)
                    setError(String(e));
            }
        },
        [widget.code, options, declared, repo, viewer],
    );
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
            epoch.current++;
        };
    }, []);
    useEffect(() => {
        void info;
        void changes;
        void repo;
        if (processing.current) refreshPending.current = true;
        else void refresh();
    }, [refresh, info, changes, repo]);

    const dispatch = (targetId: string, id: string, value?: unknown) => {
        const original = current.current.find((s) => s.id === targetId);
        if (
            !original ||
            current.current.at(-1) !== original ||
            !eventIds(original.dsl).includes(id)
        )
            return;
        const tapKey = `${targetId}:${id}`;
        const isTap = id.endsWith(":onTap");
        if (isTap && pendingTaps.current.has(tapKey)) return;
        if (isTap) pendingTaps.current.add(tapKey);
        const task = queue.current.then(async () => {
            const target = current.current.find((s) => s.id === targetId);
            if (
                !active.current ||
                !target ||
                current.current.at(-1) !== target ||
                !repo
            ) {
                pendingTaps.current.delete(tapKey);
                return;
            }
            let wroteData = false;
            processing.current = true;
            epoch.current++;
            if (isTap) setBusy(targetId);
            setError(undefined);
            const live = () =>
                active.current &&
                useUserStore.getState().id === viewer &&
                useBookStore.getState().currentBookId === repo &&
                current.current.some((s) => s.id === targetId);
            try {
                const lookup = (ref: string) => resolveFile(targetId, ref);
                const host = widgetHost(widget, repo, live, lookup);
                const snapshot = await options(target);
                const result = await runWidget(widget.code, {
                    ...snapshot,
                    runtime: {
                        ...snapshot.runtime,
                        event: { id, value },
                        allowedEvents: eventIds(target.dsl),
                    },
                    onHostCall: async (name, params) => {
                        if (!live())
                            throw new Error("Widget session has ended");
                        if (name === "openModal") {
                            const p = params as {
                                view: string;
                                params: Record<string, unknown>;
                                title: string;
                            };
                            if (
                                !p ||
                                typeof p.view !== "string" ||
                                typeof p.title !== "string" ||
                                p.title.length > 200 ||
                                current.current.length >= 8
                            )
                                throw new Error("Invalid modal");
                            current.current = [
                                ...current.current,
                                session(
                                    p.view,
                                    jsonObject.parse(p.params),
                                    p.title,
                                ),
                            ];
                            setSessions(current.current);
                            return null;
                        }
                        if (name === "closeModal") {
                            const cancel =
                                modalControllers.current.get(targetId);
                            if (
                                !cancel ||
                                current.current.at(-1)?.id !== targetId
                            )
                                throw new Error(
                                    "Only the current modal can be closed",
                                );
                            cancel();
                            return null;
                        }
                        if (preview) {
                            if (
                                !widget.permissions.includes(
                                    name === "edit" ? "edit" : "storage",
                                )
                            )
                                throw new Error("Permission denied");
                            if (name === "setStorage") {
                                simulated.current.storage =
                                    jsonObject.parse(params);
                                wroteData = true;
                                return null;
                            }
                            if (name !== "edit")
                                throw new Error("Unknown widget operation");
                            const values = simulated.current.bills ?? [];
                            const edit = validateEdit(
                                params,
                                widget.id,
                                values,
                            );
                            const created = edit.create.map((v) => ({
                                ...v,
                                images: resolveAttachments(v.images, lookup),
                                id: crypto.randomUUID(),
                                creatorId: viewer,
                                extra: { ...v.extra, widgetId: widget.id },
                            }));
                            simulated.current.bills = [
                                ...values
                                    .filter((b) => !edit.delete.includes(b.id))
                                    .map((b) => {
                                        const change = edit.update.find(
                                            (v) => v.id === b.id,
                                        );
                                        return change
                                            ? {
                                                  ...b,
                                                  ...change.value,
                                                  images:
                                                      resolveAttachments(
                                                          change.value.images,
                                                          lookup,
                                                      ) ?? b.images,
                                                  extra: {
                                                      ...b.extra,
                                                      ...change.value.extra,
                                                  },
                                              }
                                            : b;
                                    }),
                                ...created,
                            ];
                            wroteData = true;
                            return { createdIds: created.map((b) => b.id) };
                        }
                        const response = await host(name, params);
                        wroteData = true;
                        return response;
                    },
                });
                if (!result.success) throw new Error(result.error);
                current.current = current.current.map((entry) =>
                    entry.id === targetId
                        ? {
                              ...entry,
                              state: (
                                  result.result as {
                                      state: Record<string, unknown>;
                                  }
                              ).state,
                          }
                        : entry,
                );
            } catch (e) {
                if (active.current)
                    setError(e instanceof Error ? e.message : String(e));
            } finally {
                try {
                    if (active.current) {
                        if (wroteData && !preview) {
                            try {
                                await useLedgerStore
                                    .getState()
                                    .refreshBillList();
                            } catch (e) {
                                setError(String(e));
                            }
                        }
                        const refreshAll = wroteData || refreshPending.current;
                        refreshPending.current = false;
                        await latestRefresh.current(
                            refreshAll ? undefined : targetId,
                        );
                        while (active.current && refreshPending.current) {
                            refreshPending.current = false;
                            await latestRefresh.current();
                        }
                    }
                } finally {
                    processing.current = false;
                    pendingTaps.current.delete(tapKey);
                    if (active.current) setBusy(undefined);
                }
            }
        });
        queue.current = task.catch(() => {});
        return queue.current;
    };
    const latestRefresh = useRef(refresh);
    const latestDispatch = useRef(dispatch);
    useEffect(() => {
        latestRefresh.current = refresh;
        latestDispatch.current = dispatch;
    });
    const send = useCallback(
        (sessionId: string, id: string, value?: unknown) =>
            latestDispatch.current(sessionId, id, value),
        [],
    );
    const pick = useCallback(
        (sessionId: string, eventId: string, selected: File[]) => {
            const target = current.current.at(-1);
            if (
                !target ||
                target.id !== sessionId ||
                !target.canPickFiles ||
                target.attachmentRepo !== repo ||
                target.attachmentViewer !== viewer ||
                !eventIds(target.dsl).includes(eventId)
            )
                return;
            if (
                selected.length > 3 ||
                selected.some(
                    (file) =>
                        !FORMAT_IMAGE_SUPPORTED.split(",").includes(
                            file.type,
                        ) ||
                        file.size === 0 ||
                        file.size > 10 * 1024 * 1024,
                )
            ) {
                setError(
                    "最多选择 3 张 PNG、JPEG、GIF 或 WebP 图片，每张不超过 10 MB。",
                );
                return;
            }
            const fields =
                files.get(sessionId) ?? new Map<string, Map<string, File>>();
            if (!fields.has(eventId) && fields.size >= 10) {
                setError("此视图的附件选择器数量已达上限。");
                return;
            }
            const selection = new Map(
                selected.map((file) => [attachmentRef(), file]),
            );
            fields.set(eventId, selection);
            files.set(sessionId, fields);
            return send(sessionId, eventId, [...selection.keys()]);
        },
        [files, repo, viewer, send],
    );
    useEffect(() => {
        const ids = new Set(sessions.map((entry) => entry.id));
        for (const id of files.keys()) {
            if (!ids.has(id)) files.delete(id);
        }
    }, [files, sessions]);
    const main = sessions[0];
    const activeId = sessions.at(-1)?.id;
    const renderView = (entry: Session) => (
        <SessionView
            session={entry}
            busy={busy === entry.id}
            send={send}
            pick={pick}
            resolveFile={resolveFile}
            attachmentAccess={
                repo === entry.attachmentRepo &&
                viewer === entry.attachmentViewer
            }
        />
    );
    const eventError = (id: string) =>
        error && activeId === id ? (
            <p role="alert" className="text-sm text-red-500">
                {error}
            </p>
        ) : null;
    return (
        <div className={className}>
            {renderView(main)}
            {eventError(main.id)}
            {[...sessions.slice(1), ...closing].map((entry) => (
                <WidgetModal
                    key={entry.id}
                    id={entry.id}
                    title={entry.title ?? widget.name}
                    onOpen={registerModal}
                    onClose={dismissModal}
                    onExited={removeModal}
                >
                    <h2
                        data-widget-modal-title
                        tabIndex={-1}
                        className="font-semibold mb-4 outline-none"
                    >
                        {entry.title ?? widget.name}
                    </h2>
                    <div className="min-h-0 overflow-y-auto p-1">
                        {renderView(entry)}
                        {eventError(entry.id)}
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            modalControllers.current.get(entry.id)?.()
                        }
                        disabled={busy === entry.id}
                        className="mt-4 self-end border rounded px-3 py-1"
                    >
                        关闭
                    </button>
                </WidgetModal>
            ))}
        </div>
    );
}

function SessionView({
    session,
    busy,
    send,
    pick,
    resolveFile,
    attachmentAccess,
}: {
    session: Session;
    pick: (
        sessionId: string,
        eventId: string,
        files: File[],
    ) => Promise<void> | undefined;
    resolveFile: (sessionId: string, ref: string) => File | undefined;
    attachmentAccess: boolean;
    busy: boolean;
    send: (
        sessionId: string,
        id: string,
        value?: unknown,
    ) => Promise<void> | undefined;
}) {
    const id = session.id;
    const onEvent = useCallback(
        (eventId: string, value?: unknown) => send(id, eventId, value),
        [send, id],
    );
    const { attachmentSources, canPickFiles } = session;
    const attachments = useMemo(
        () =>
            attachmentAccess
                ? {
                      pick: canPickFiles
                          ? (eventId: string, files: File[]) =>
                                pick(id, eventId, files)
                          : undefined,
                      draft: (ref: string) => resolveFile(id, ref),
                      saved: (billId: string, index: number) =>
                          attachmentSources?.get(billId)?.[index],
                  }
                : undefined,
        [
            attachmentAccess,
            attachmentSources,
            canPickFiles,
            id,
            pick,
            resolveFile,
        ],
    );
    if (!session.dsl && session.renderError) {
        return (
            <p role="alert" className="text-sm text-red-500">
                {session.renderError}
            </p>
        );
    }
    return (
        <>
            <WidgetRenderer
                dsl={session.dsl}
                busy={busy}
                onEvent={onEvent}
                attachments={attachments}
            />
            {session.renderError && (
                <p role="alert" className="text-sm text-red-500">
                    {session.renderError}
                </p>
            )}
        </>
    );
}
