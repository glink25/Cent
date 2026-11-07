import type {
    ChangeProposal,
    ChangeReceipt,
    ToolContext,
} from "@glink25/chaty";
import { isEqual } from "lodash-es";
import { toast } from "sonner";
import { create } from "zustand";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { Action } from "@/database/stash";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";

type Snapshot = { bills: Bill[]; meta: GlobalMeta; viewer: string | number };
type BillPatch = { id: string; before?: Bill; after?: Bill };
type MetaPatch = {
    key: keyof GlobalMeta;
    user?: string | number;
    field?: string;
    before?: unknown;
    after?: unknown;
};
type Patch = BillPatch | MetaPatch;
type Change = {
    scope: string;
    book: string;
    proposal: ChangeProposal;
    patches: Patch[];
    receipt?: ChangeReceipt;
    source: string;
};
type Decision = { approved: boolean; remember?: boolean };
const active = new Map<string, Change>();
const locks = new Map<string, Promise<unknown>>();
const storageKey = "cent-agent-grants-v1";
const database = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("cent-agent-changes", 1);
        request.onupgradeneeded = () =>
            request.result.createObjectStore("changes");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

async function journal(
    id: string,
    value?: Change,
): Promise<Change | undefined> {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(
                "changes",
                value ? "readwrite" : "readonly",
            );
            const store = tx.objectStore("changes");
            const request = value ? store.put(value, id) : store.get(id);
            tx.oncomplete = () => resolve(value ?? request.result);
            tx.onabort = () => reject(tx.error);
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

async function currentScope() {
    const { StorageAPI } = await loadStorageAPI();
    const book = useBookStore.getState().currentBookId;
    const viewer = useUserStore.getState().id;
    return {
        book,
        viewer,
        scope: JSON.stringify([StorageAPI.type, book, viewer]),
        api: StorageAPI,
    };
}

type Grant = { key: string; scope: string; label: string };
export function listChangeGrants(): Grant[] {
    try {
        return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
        return [];
    }
}
export function revokeChangeGrant(key: string) {
    localStorage.setItem(
        storageKey,
        JSON.stringify(listChangeGrants().filter((item) => item.key !== key)),
    );
}

export const useExternalApprovals = create<{
    items: {
        proposal: ChangeProposal;
        decide: (approved: boolean, remember?: boolean) => void;
    }[];
}>(() => ({ items: [] }));

function requestExternalApproval(
    proposal: ChangeProposal,
    signal?: AbortSignal,
) {
    return new Promise<Decision>((resolve) => {
        const cancel = () => decide(false);
        const decide = (approved: boolean, remember?: boolean) => {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", cancel);
            useExternalApprovals.setState((state) => ({
                items: state.items.filter(
                    (item) => item.proposal.id !== proposal.id,
                ),
            }));
            resolve({ approved, remember });
        };
        const timeout = setTimeout(cancel, 120_000);
        if (signal?.aborted) cancel();
        else {
            signal?.addEventListener("abort", cancel, { once: true });
            useExternalApprovals.setState((state) => ({
                items: [...state.items, { proposal, decide }],
            }));
        }
    });
}

export function cancelExternalApprovals() {
    for (const item of useExternalApprovals.getState().items)
        item.decide(false);
}

async function snapshot(
    book: string,
    api: Awaited<ReturnType<typeof currentScope>>["api"],
    viewer: Snapshot["viewer"],
): Promise<Snapshot> {
    const [bills, meta] = await Promise.all([
        api.getAllItems(book),
        api.getMeta(book),
    ]);
    return {
        bills: bills.map(
            ({ __create_at, __update_at, __delete_at, ...bill }) => bill,
        ),
        meta,
        viewer,
    };
}

function target(patch: Patch) {
    return "id" in patch ? `bill:${patch.id}` : (patch.field ?? patch.key);
}

function valueAt(data: Snapshot, patch: Patch) {
    if ("id" in patch) return data.bills.find((bill) => bill.id === patch.id);
    if (patch.user !== undefined && patch.field) {
        return data.meta.personal?.[patch.user]?.[
            patch.field as keyof NonNullable<GlobalMeta["personal"]>[string]
        ];
    }
    return data.meta[patch.key];
}

function makeReceipt(
    change: Change,
    status: ChangeReceipt["status"],
    results: ChangeReceipt["results"] = [],
): ChangeReceipt {
    return {
        kind: "changeReceipt",
        proposal: change.proposal,
        status,
        results,
        undo:
            status === "applied" || status === "partial" ? "direct" : undefined,
    };
}

async function serial<T>(scope: string, run: () => Promise<T>) {
    const pending = (locks.get(scope) ?? Promise.resolve())
        .catch(() => {})
        .then(() =>
            typeof navigator !== "undefined" && navigator.locks
                ? navigator.locks.request(`cent-agent:${scope}`, run)
                : run(),
        );
    locks.set(scope, pending);
    try {
        return await pending;
    } finally {
        if (locks.get(scope) === pending) locks.delete(scope);
    }
}

async function apply(
    change: Change,
    undo = false,
    signal?: AbortSignal,
): Promise<ChangeReceipt> {
    return serial(change.scope, async () => {
        const { book, viewer, scope, api } = await currentScope();
        if (scope !== change.scope || book !== change.book || signal?.aborted)
            return makeReceipt(change, "expired");
        const recorded = await journal(change.proposal.id);
        if (!undo && recorded)
            return recorded.receipt ?? makeReceipt(change, "conflict");
        if (undo && !recorded?.receipt?.undo)
            return makeReceipt(change, "conflict");
        const data = await snapshot(book, api, viewer);
        const prior = undo ? "after" : "before";
        const next = undo ? "before" : "after";
        const patches = undo
            ? change.patches.filter((patch) =>
                  change.receipt?.results.some(
                      (result) =>
                          result.target === target(patch) &&
                          result.status === "applied",
                  ),
              )
            : change.patches;
        if (
            !patches.length ||
            patches.some(
                (patch) => !isEqual(valueAt(data, patch), patch[prior]),
            )
        )
            return makeReceipt(change, "conflict");
        const meta = { ...data.meta };
        const actions: Action<Bill>[] = [];
        for (const patch of patches) {
            if ("id" in patch) {
                const value = patch[next];
                actions.push(
                    value
                        ? { type: "update", value }
                        : { type: "delete", value: patch.id },
                );
            } else if (patch.user !== undefined && patch.field) {
                const personal = {
                    ...meta.personal?.[patch.user],
                    [patch.field]: patch[next],
                };
                meta.personal = { ...meta.personal, [patch.user]: personal };
            } else {
                Object.assign(meta, { [patch.key]: patch[next] });
            }
        }
        if (patches.some((patch) => "key" in patch))
            actions.push({ type: "meta", metaValue: meta });
        if ((await currentScope()).scope !== change.scope || signal?.aborted)
            return makeReceipt(change, "expired");
        if (!undo) await journal(change.proposal.id, change);
        if ((await currentScope()).scope !== change.scope || signal?.aborted)
            return makeReceipt(change, "expired");
        let succeeded = false;
        try {
            await api.batch(book, actions);
            succeeded = true;
        } catch {
            // A storage error may be reported after some records have been saved.
        }
        let actual: Snapshot | undefined;
        try {
            actual = await snapshot(book, api, viewer);
        } catch {}
        const results = patches.map(
            (patch): ChangeReceipt["results"][number] => ({
                target: target(patch),
                status:
                    actual && isEqual(valueAt(actual, patch), patch[next])
                        ? "applied"
                        : actual &&
                            isEqual(valueAt(actual, patch), patch[prior])
                          ? "unchanged"
                          : "unknown",
            }),
        );
        const all = results.every((result) => result.status === "applied");
        const some = results.some((result) => result.status === "applied");
        const status = all
            ? undo
                ? "undone"
                : "applied"
            : some
              ? "partial"
              : succeeded
                ? "conflict"
                : "failed";
        const receipt = makeReceipt(change, status, results);
        if (undo && !all) receipt.undo = undefined;
        change.receipt = receipt;
        await journal(change.proposal.id, change);
        return receipt;
    });
}

type Prepared = { patches: Patch[]; alwaysAsk?: boolean };
type Prepare = (snapshot: Snapshot) => Prepared | Promise<Prepared>;
type Scope = Awaited<ReturnType<typeof currentScope>>;
const batchKey = "cent:change-batch";

type StagedBatch = {
    stage: (prepare: Prepare) => Promise<unknown>;
    finish: (ctx: ToolContext) => Promise<unknown>;
};

function projectSnapshot(data: Snapshot, patches: Patch[]): Snapshot {
    const bills = new Map(data.bills.map((bill) => [bill.id, bill]));
    const meta = { ...data.meta };
    for (const patch of patches) {
        if ("id" in patch) {
            if (patch.after) bills.set(patch.id, patch.after);
            else bills.delete(patch.id);
        } else if (patch.user !== undefined && patch.field) {
            const personal = {
                ...meta.personal?.[patch.user],
                [patch.field]: patch.after,
            };
            meta.personal = { ...meta.personal, [patch.user]: personal };
        } else {
            Object.assign(meta, { [patch.key]: patch.after });
        }
    }
    return { ...data, bills: [...bills.values()], meta };
}

export function createChangeBatch(context: ToolContext) {
    let initial: { owner: Scope; data: Snapshot } | undefined;
    let tail: Promise<unknown> = Promise.resolve();
    let staged = 0;
    let closed = false;
    const patches = new Map<string, Patch>();
    const batch: StagedBatch = {
        stage(prepare) {
            if (closed) throw new Error("The playground write batch is closed");
            const next = tail.then(async () => {
                context.signal?.throwIfAborted();
                if (++staged > 100)
                    throw new Error(
                        "A playground batch can stage at most 100 write requests",
                    );
                if (!initial) {
                    const owner = await currentScope();
                    if (!owner.book) throw new Error("No active ledger");
                    initial = {
                        owner,
                        data: await snapshot(
                            owner.book,
                            owner.api,
                            owner.viewer,
                        ),
                    };
                }
                if ((await currentScope()).scope !== initial.owner.scope)
                    throw new Error("Ledger context changed");
                const data = projectSnapshot(initial.data, [
                    ...patches.values(),
                ]);
                const prepared = await prepare(data);
                for (const patch of prepared.patches) {
                    const key = target(patch);
                    const original = patches.get(key);
                    patches.set(
                        key,
                        original
                            ? ({ ...patch, before: original.before } as Patch)
                            : patch,
                    );
                }
                if (patches.size > 100)
                    throw new Error(
                        "A playground batch can change at most 100 targets",
                    );
                return {
                    status: "staged",
                    targets: prepared.patches.map(target),
                };
            });
            tail = next;
            return next;
        },
        async finish(ctx) {
            closed = true;
            await tail;
            if (!initial || !patches.size) return undefined;
            return submitChange(ctx, initial.owner, "playground", "batch", {
                patches: [...patches.values()],
                alwaysAsk: true,
            });
        },
    };
    context.resources?.set(batchKey, batch);
    return {
        finish: batch.finish,
        dispose() {
            closed = true;
            if (context.resources?.get(batchKey) === batch)
                context.resources.delete(batchKey);
        },
    };
}

export async function proposeChange(
    ctx: ToolContext,
    resource: string,
    operation: string,
    prepare: Prepare,
) {
    if (ctx.surface === "code") {
        const batch = ctx.resources?.get(batchKey) as StagedBatch | undefined;
        if (!batch)
            throw new Error("Writes require a host-managed playground batch");
        return batch.stage(prepare);
    }
    const owner = await currentScope();
    if (!owner.book) throw new Error("No active ledger");
    ctx.signal?.throwIfAborted();
    const prepared = await prepare(
        await snapshot(owner.book, owner.api, owner.viewer),
    );
    return submitChange(ctx, owner, resource, operation, prepared);
}

async function submitChange(
    ctx: ToolContext,
    { book, scope }: Scope,
    resource: string,
    operation: string,
    { patches, alwaysAsk }: Prepared,
) {
    if (!book) throw new Error("No active ledger");
    ctx.signal?.throwIfAborted();
    if ((await currentScope()).scope !== scope)
        throw new Error("Ledger context changed");
    const effective = patches.filter(
        (patch) => !isEqual(patch.before, patch.after),
    );
    if (!effective.length) return { status: "unchanged" };
    const source = ctx.source ?? "chat";
    const canRemember = operation !== "delete" && !alwaysAsk;
    const title = `${resource} · ${operation}`;
    const proposal: ChangeProposal = {
        id: crypto.randomUUID(),
        title: source === "webmcp" ? `WebMCP · ${title}` : title,
        canRemember,
        diffs: effective.map((patch) => ({
            target: target(patch),
            before: patch.before,
            after: patch.after,
        })),
    };
    const change: Change = {
        scope,
        book,
        proposal,
        patches: effective,
        source,
    };
    const key = JSON.stringify([scope, source, resource, operation]);
    const execute = async () => {
        const remembered =
            canRemember &&
            listChangeGrants().some((grant) => grant.key === key);
        const approval =
            ctx.source === "webmcp"
                ? requestExternalApproval
                : ctx.approveChange;
        if (!remembered && !approval)
            throw new Error("Approval surface unavailable");
        const started = Date.now();
        const decision = remembered
            ? { approved: true }
            : await approval?.(proposal, ctx.signal);
        if (!decision?.approved) {
            change.receipt = makeReceipt(
                change,
                ctx.signal?.aborted || Date.now() - started >= 120_000
                    ? "expired"
                    : "rejected",
            );
            return change.receipt;
        }
        const receipt = await apply(change, false, ctx.signal);
        change.receipt = receipt;
        if (canRemember && decision.remember && receipt.status === "applied") {
            localStorage.setItem(
                storageKey,
                JSON.stringify([
                    ...listChangeGrants().filter((grant) => grant.key !== key),
                    { key, scope, label: `${source} · ${title}` },
                ]),
            );
        }
        return receipt;
    };
    if (source !== "webmcp") return execute();
    active.set(proposal.id, change);
    void execute()
        .catch(() => makeReceipt(change, "failed"))
        .then(async (receipt) => {
            change.receipt = receipt;
            if (receipt.status === "applied" || receipt.status === "partial")
                active.delete(proposal.id);
            else setTimeout(() => active.delete(proposal.id), 10 * 60_000);
            if ((await currentScope()).scope === scope)
                notifyExternalChange(receipt);
        });
    return { status: "pending", changeId: proposal.id };
}

export async function getChangeStatus(id: string) {
    const change = active.get(id) ?? (await journal(id));
    if (
        !change ||
        change.source !== "webmcp" ||
        change.scope !== (await currentScope()).scope
    )
        return { status: "unavailable" };
    return (
        change.receipt ?? {
            status: active.has(id) ? "pending" : "unknown",
            changeId: id,
        }
    );
}

export async function undoChange(id: string, source = "chat") {
    const change = await journal(id);
    if (
        !change ||
        change.source !== source ||
        change.scope !== (await currentScope()).scope ||
        !change.receipt?.undo
    )
        throw new Error("Change cannot be undone");
    return apply(change, true);
}

function notifyExternalChange(receipt: ChangeReceipt) {
    const zh = usePreferenceStore.getState().locale === "zh";
    const { status, proposal } = receipt;
    if (status === "applied" || status === "partial") {
        const count = receipt.results.filter(
            (item) => item.status === "applied",
        ).length;
        const title =
            status === "applied"
                ? zh
                    ? "WebMCP 已写入"
                    : "WebMCP changes applied"
                : zh
                  ? "WebMCP 部分写入"
                  : "WebMCP changes partially applied";
        toast[status === "applied" ? "success" : "warning"](
            `${title} · ${count}/${proposal.diffs.length}`,
            {
                duration: receipt.undo ? 10_000 : undefined,
                className: receipt.undo ? "transition-none!" : undefined,
                action: receipt.undo
                    ? {
                          label: zh ? "撤回" : "Undo",
                          onClick: async () => {
                              try {
                                  const result = await undoChange(
                                      proposal.id,
                                      "webmcp",
                                  );
                                  if (result.status === "undone") {
                                      toast.success(
                                          zh
                                              ? "WebMCP 变更已撤回"
                                              : "WebMCP changes undone",
                                      );
                                  } else {
                                      toast.error(
                                          zh
                                              ? "无法撤回，账本数据已变化"
                                              : "Unable to undo because the ledger changed",
                                      );
                                  }
                              } catch {
                                  toast.error(
                                      zh
                                          ? "无法撤回此变更"
                                          : "Unable to undo this change",
                                  );
                              }
                          },
                      }
                    : undefined,
            },
        );
    } else if (status === "rejected" || status === "expired") {
        toast.info(
            status === "rejected"
                ? zh
                    ? "已取消 WebMCP 写入"
                    : "WebMCP write canceled"
                : zh
                  ? "WebMCP 审批已失效"
                  : "WebMCP approval expired",
        );
    } else {
        toast.error(
            zh
                ? "WebMCP 写入未完成，请查看变更状态"
                : "WebMCP write did not complete. Check the change status.",
        );
    }
}
