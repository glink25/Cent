import { uniqueId } from "lodash-es";

// HashBack.ts
export type OnHistoryBack = (meta?: { id: string }) => void;

export interface HashBackController {
    /** 打开（push 一个历史记录），返回当前 entry id */
    open(key?: string): string;
    /** 主动关闭（会调用 onHistoryBack，然后触发 history.back() 保持路由一致） */
    close(): void;
    /** 仅回退历史而不触发回调（不常用） */
    backOnly(): void;
    /** 当前是否为打开状态（在 stack 中） */
    isOpen(): boolean;
    /** 返回当前堆栈（只读副本） */
    getStack(): string[];
    /** 卸载该 controller（从 stack 中移除并释放回调） */
    dispose(): void;
}

function makeUniqueId(prefix = "hb"): string {
    return `${prefix}_${uniqueId()}`;
}

export class HashBack {
    private stack: { id: string; onHistoryBack: OnHistoryBack }[] = [];
    private programmaticClosingId: string | null = null;
    private enabled = true;

    constructor(opts?: { enabled?: boolean }) {
        if (opts?.enabled === false) this.enabled = false;
        // popstate 处理：浏览器后退（包括安卓物理返回）会触发
        window.addEventListener("popstate", this.handlePopState);
    }

    /** 创建并注册一个 handler，返回 controller 用于 open/close 等 */
    register(onHistoryBack: OnHistoryBack): HashBackController {
        if (!this.enabled) {
            // no-op controller
            return {
                open: () => "",
                close: () => {},
                backOnly: () => {},
                isOpen: () => false,
                getStack: () => [],
                dispose: () => {},
            };
        }

        const entry = { id: "", onHistoryBack };
        let disposed = false;

        const controller: HashBackController = {
            open: (key?: string) => {
                if (disposed) throw new Error("controller disposed");
                // create id
                const id = key
                    ? `${String(key).replace(/^\/+/, "")}_${makeUniqueId()}`
                    : makeUniqueId();
                entry.id = id;
                this.pushEntry(entry.id, entry.onHistoryBack);
                return entry.id;
            },
            close: () => {
                if (disposed) return;
                if (!entry.id) return;
                if (!this.isTopEntry(entry.id)) {
                    // 如果不是顶层，允许直接从 anywhere 强制移除（把它从 stack 中移除并不调整历史）
                    // 但通常不建议这样调用。这里我们尽量保持安全性：直接调用回调并从 stack 中移除。
                    this.removeEntryById(entry.id, true);
                    return;
                }
                // 正常关闭：先触发回调（UI 隐藏），再触发 history.back() 保持路由一致。
                // 标记 programmaticClosingId 以便 popstate handler 不重复调用回调。
                this.programmaticClosingId = entry.id;
                try {
                    // 调用回调一次（让 UI 隐藏）
                    entry.onHistoryBack({ id: entry.id });
                } finally {
                    // 之后发起历史回退以保证地址栏和历史一致
                    // history.back() 会触发 popstate；popstate 中会检测 programmaticClosingId 并避免重复调用。
                    window.history.back();
                }
            },
            backOnly: () => {
                if (disposed) return;
                if (!entry.id) return;
                this.programmaticClosingId = entry.id;
                window.history.back();
            },
            isOpen: () => {
                return !!(
                    entry.id && this.stack.find((s) => s.id === entry.id)
                );
            },
            getStack: () => this.stack.map((s) => s.id),
            dispose: () => {
                if (disposed) return;
                disposed = true;
                if (entry.id) {
                    this.removeEntryById(entry.id, true);
                }
            },
        };

        return controller;
    }

    /** 手动启用/禁用整套功能 */
    setEnabled(v: boolean) {
        this.enabled = !!v;
    }

    /** 清理（解绑 popstate） */
    destroy() {
        window.removeEventListener("popstate", this.handlePopState);
        this.stack = [];
        this.programmaticClosingId = null;
        this.enabled = false;
    }

    /** push 一个 entry 到 stack，并在地址栏生成 hash/history */
    private pushEntry(id: string, onHistoryBack: OnHistoryBack) {
        // push 到内部 stack
        this.stack.push({ id, onHistoryBack });

        // build a visible hash (保证可见，例如 #/hb/<id> )
        const hash = `#/hb/${encodeURIComponent(id)}`;

        // 如果这是 stack 的第一个元素，我们 replaceState 一个基线（hb=0）然后 push
        // 这样用户第一次按后退不会直接退出 PWA（会回到基线 state）
        const basePath = window.location.pathname + window.location.search;
        if (this.stack.length === 1) {
            // replace current state to baseline with hb=0
            window.history.replaceState({ hb: 0 }, "", `${basePath}${hash}`);
            // then push the modal state (hb=1)
            window.history.pushState({ hb: 1, id }, "", `${basePath}${hash}`);
        } else {
            // 其它层直接 push
            const n = this.stack.length;
            window.history.pushState({ hb: n, id }, "", `${basePath}${hash}`);
        }
    }

    private isTopEntry(id: string) {
        const top = this.stack[this.stack.length - 1];
        return !!top && top.id === id;
    }

    /** 从 stack 中移除某个 entry。如果 callHandler=true 会调用它的回调（用于非顶层直接移除） */
    private removeEntryById(id: string, callHandler = false) {
        const idx = this.stack.findIndex((s) => s.id === id);
        if (idx === -1) return false;
        const [entry] = this.stack.splice(idx, 1);
        if (callHandler) {
            try {
                entry.onHistoryBack({ id: entry.id });
            } catch (e) {
                console.error("HashBack: onHistoryBack error during remove", e);
            }
        }
        return true;
    }

    /** popstate 处理函数（用箭头保持 this） */
    private handlePopState = (ev: PopStateEvent) => {
        if (!this.enabled) return;

        // Only handle our own states (we set {hb: ...}).
        const state = (ev.state ?? {}) as any;
        if (state && state.hb === undefined) {
            // 非 HashBack 的历史操作 — 忽略
            return;
        }

        // If no entries in stack, nothing for us (let navigation continue).
        if (this.stack.length === 0) {
            return;
        }

        // pop the top entry
        const top = this.stack.pop();
        if (!top) return;

        // If this pop corresponds to a programmatic close we initiated, we already invoked the onHistoryBack in close(),
        // so avoid calling again.
        if (
            this.programmaticClosingId &&
            this.programmaticClosingId === top.id
        ) {
            this.programmaticClosingId = null;
            return;
        }

        // Otherwise, call the callback so the UI can close.
        try {
            top.onHistoryBack({ id: top.id });
        } catch (err) {
            console.error("HashBack: onHistoryBack handler threw", err);
        }
    };
}
const hashBack = new HashBack();
export default hashBack;
