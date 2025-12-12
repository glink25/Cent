export class Scheduler {
    private callback: (signal: AbortSignal) => void | Promise<void>;
    private delay: number;

    private timer: ReturnType<typeof setTimeout> | null = null;
    private currentController: AbortController | null = null;
    private generation = 0;

    private runningCallbackPromise: Promise<void> | null = null;

    private sessionResolve: (() => void) | null = null;
    private sessionReject: ((err: any) => void) | null = null;
    private sessionPromise: Promise<void> | null = null;

    private listeners = new Set<(running: Promise<void>) => void>();

    constructor(
        callback: (signal: AbortSignal) => void | Promise<void>,
        delay: number = 0,
    ) {
        this.callback = callback;
        this.delay = delay;
    }

    async schedule() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.currentController) {
            try {
                this.currentController.abort();
            } catch {
                // ignore
            }
        }

        this.generation += 1;
        const myGeneration = this.generation;

        if (!this.sessionPromise) {
            this.sessionPromise = new Promise<void>((res, rej) => {
                this.sessionResolve = res;
                this.sessionReject = rej;
            });
            for (const l of this.listeners) {
                try {
                    l(this.sessionPromise);
                } catch {
                    // ignore listener errors
                }
            }
        }

        const controller = new AbortController();
        this.currentController = controller;

        if (this.delay <= 0) {
            this.startCallback(controller, myGeneration);
        } else {
            this.timer = setTimeout(() => {
                this.timer = null;
                if (myGeneration !== this.generation) return;
                if (controller !== this.currentController) return;
                this.startCallback(controller, myGeneration);
            }, this.delay);
        }
    }

    onProcess(listener: (running: Promise<void>) => void): () => void {
        this.listeners.add(listener);
        if (this.sessionPromise) {
            try {
                listener(this.sessionPromise);
            } catch {
                // ignore
            }
        }
        return () => {
            this.listeners.delete(listener);
        };
    }

    private async startCallback(controller: AbortController, gen: number) {
        if (gen !== this.generation) return;
        if (controller !== this.currentController) return;

        let p: Promise<void>;
        try {
            const maybe = this.callback(controller.signal);
            p = Promise.resolve(maybe);
        } catch (err) {
            p = Promise.reject(err);
        }

        this.runningCallbackPromise = p;

        try {
            await p;
            if (gen === this.generation) {
                if (this.sessionResolve) {
                    this.sessionResolve();
                }
                this.clearSession();
            }
        } catch (err) {
            if (gen === this.generation) {
                if (this.sessionReject) {
                    this.sessionReject(err);
                }
                this.clearSession();
            }
        } finally {
            if (controller === this.currentController) {
                this.currentController = null;
            }
            this.runningCallbackPromise = null;
        }
    }

    private clearSession() {
        this.sessionPromise = null;
        this.sessionResolve = null;
        this.sessionReject = null;
    }
}
