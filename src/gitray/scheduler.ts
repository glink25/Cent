export class Scheduler {
	private pendingTicks = 0; // 待累计的单位次数（每次 schedule +1）
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private postRunPending = false; // 运行期间是否至少被请求过一次
	private readonly unitMs: number;

	// 当还有一个尚未触发的计划时，保存对应的 AbortController
	private currentAbortController: AbortController | null = null;

	// callback 接收 AbortSignal
	private readonly callback: (signal: AbortSignal) => void | Promise<void>;

	// 监听器集合（onProcess 注册）
	private listeners = new Set<(v: Promise<void>) => void>();

	// 当前 processing session（如果存在），用于让 listener 拿到一个在整个会话结束时才 resolve 的 promise
	private currentProcess: {
		promise: Promise<void>;
		resolve: () => void;
		reject: (err: any) => void;
	} | null = null;

	constructor(
		callback: (signal: AbortSignal) => void | Promise<void>,
		unitMs = 2000,
	) {
		this.callback = callback;
		this.unitMs = unitMs;
	}

	/**
	 * 安排一次 sync：
	 * - 若当前正在运行，只标记 postRunPending（只会在运行结束后触发一次）
	 * - 否则 pendingTicks += 1 并重设定时器（延迟 = pendingTicks * unitMs）
	 */
	scheduleSync(): void {
		if (this.running) {
			this.postRunPending = true;
			// 即便在运行期间设置了 postRunPending，也要确保外部注册的 process listener
			// 能感知到会话（如果会话已存在则会被复用）。
			return;
		}

		this.pendingTicks += 1;

		// 为未触发的计划准备 controller（如果还没有）
		if (!this.currentAbortController) {
			this.currentAbortController = new AbortController();
		}

		// 重设定时器（如果已有定时器则先清掉）
		if (this.timer) {
			clearTimeout(this.timer);
		}

		const delay = this.pendingTicks * this.unitMs;
		this.timer = setTimeout(async () => {
			this.timer = null;

			// 取出并“解附”当前 controller；运行期间不再由 cancel() 影响此 controller（与旧语义一致）
			const controller = this.currentAbortController;
			this.currentAbortController = null;

			// consume accumulated ticks now
			this.pendingTicks = 0;

			// 将 controller.signal 传给 runSync（若没有 controller，传入一个永不中止的 signal）
			const signal = controller
				? controller.signal
				: new AbortController().signal;
			await this.runSync(signal);
		}, delay);
		// scheduleSync 改变了“是否有待触发任务”的状态，尝试完成会话（在大多数情况不会结束）
		this.maybeFinishProcess();
	}

	/** 取消当前计划（不会影响正在运行的 sync） */
	cancel(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pendingTicks = 0;
		this.postRunPending = false;

		// 如果有尚未触发的计划的 controller，abort 它，这样 callback 内的 fetch 会被中止
		if (this.currentAbortController) {
			try {
				this.currentAbortController.abort();
			} catch (e) {
				// 忽略
			}
			this.currentAbortController = null;
		}

		// 取消可能导致“没有更多工作”，尝试结束当前会话
		this.maybeFinishProcess();
	}

	/** 清理并取消（和 cancel 相同，语义上用于资源释放） */
	dispose(): void {
		this.cancel();
		// 若需要可以释放其它资源
	}

	/**
	 * 内部执行 sync 的 wrapper，负责合并运行期间的请求
	 * 接受一个可选 signal（由触发该次 run 的 AbortController 提供）
	 */
	private async runSync(signal?: AbortSignal): Promise<void> {
		if (this.running) {
			// 理论上不会到这里，但保险处理
			this.postRunPending = true;
			return;
		}

		// 标记正在运行
		this.running = true;

		// 如果没有会话（currentProcess），在第一次实际启动运行时创建一个会话，
		// 并把 promise 分发给全部 listeners
		if (!this.currentProcess) {
			let resolveFn!: () => void;
			let rejectFn!: (err: any) => void;
			const p = new Promise<void>((resolve, reject) => {
				resolveFn = resolve;
				rejectFn = reject;
			});
			this.currentProcess = {
				promise: p,
				resolve: resolveFn,
				reject: rejectFn,
			};

			// 通知所有监听器当前会话开始（立即传入 promise）
			for (const l of Array.from(this.listeners)) {
				try {
					l(this.currentProcess.promise);
				} catch (e) {
					// 忽略 listener 抛出
					console.error("Scheduler.onProcess listener threw:", e);
				}
			}
		}

		try {
			await Promise.resolve(
				this.callback(signal ?? new AbortController().signal),
			);
		} catch (err) {
			// 若 callback 抛错，记录错误并将会话 promise reject（以便监听者知道失败）
			console.error("SyncScheduler callback error:", err);
			if (this.currentProcess) {
				try {
					this.currentProcess.reject(err);
				} catch (e) {
					/* ignore */
				}
				// 清掉会话（后续 maybeFinishProcess 也会尝试清理，但这里可直接清空以避免重复）
				this.currentProcess = null;
			}
		} finally {
			this.running = false;

			// 如果运行期间被请求过，复位标记并触发一次 schedule（会加 1 个单位延迟）
			if (this.postRunPending) {
				this.postRunPending = false;
				this.scheduleSync();
			}

			// 尝试结束会话（如果没有后续工作了，则 resolve currentProcess）
			this.maybeFinishProcess();
		}
	}

	/**
	 * 如果当前没有后续工作（无 timer、无 pendingTicks、无 postRunPending、且不在 running 中）
	 * 则认为会话结束，resolve currentProcess（若存在）
	 */
	private maybeFinishProcess() {
		const noPendingWork =
			!this.running &&
			!this.postRunPending &&
			this.pendingTicks === 0 &&
			this.timer === null;
		if (noPendingWork && this.currentProcess) {
			try {
				this.currentProcess.resolve();
			} catch (e) {
				/* ignore */
			}
			this.currentProcess = null;
		}
	}

	/**
	 * 新增：注册一个 listener，用于监听 callback 的运行情况
	 * listener 会在会话开始时（或在注册时如果已有正在进行的会话）被调用，参数是一个 Promise<void>
	 * 返回一个取消函数用于取消监听
	 */
	public onProcess(listener: (v: Promise<void>) => void): () => void {
		this.listeners.add(listener);

		// 如果当前已有会话正在进行，立即把会话的 promise 发给新 listener
		if (this.currentProcess) {
			try {
				listener(this.currentProcess.promise);
			} catch (e) {
				// 忽略 listener 内抛出错误
				console.error("Scheduler.onProcess listener threw on registration:", e);
			}
		}

		// 返回取消绑定函数
		return () => {
			this.listeners.delete(listener);
		};
	}
}
