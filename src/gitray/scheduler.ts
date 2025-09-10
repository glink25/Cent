export class Scheduler {
	private pendingTicks = 0; // 待累计的单位次数（每次 schedule +1）
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private postRunPending = false; // 运行期间是否至少被请求过一次
	private readonly unitMs: number;
	private readonly callback: () => void | Promise<void>;

	/**
	 * @param syncFn 要执行的同步回调（可同步或异步）
	 * @param unitMs 每次 schedule 增加的延迟（毫秒），默认 2000
	 */
	constructor(callback: () => void | Promise<void>, unitMs = 2000) {
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
			return;
		}

		this.pendingTicks += 1;
		if (this.timer) {
			clearTimeout(this.timer);
		}

		const delay = this.pendingTicks * this.unitMs;
		this.timer = setTimeout(async () => {
			this.timer = null;
			// consume accumulated ticks now
			this.pendingTicks = 0;
			await this.runSync();
		}, delay);
	}

	/** 取消当前计划（不会影响正在运行的 sync） */
	cancel(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pendingTicks = 0;
		this.postRunPending = false;
	}

	/** 清理并取消（和 cancel 相同，语义上用于资源释放） */
	dispose(): void {
		this.cancel();
		// 如果需要可以置空 syncFn，但一般不必
	}

	/** 内部执行 sync 的 wrapper，负责合并运行期间的请求 */
	private async runSync(): Promise<void> {
		if (this.running) {
			// 理论上不会到这里，但保险处理
			this.postRunPending = true;
			return;
		}

		this.running = true;
		try {
			await Promise.resolve(this.callback());
		} catch (err) {
			// 保持健壮：记录错误但不破坏后续流程
			// 你可以替换为更合适的错误上报方式
			console.error("SyncScheduler syncFn error:", err);
		} finally {
			this.running = false;
			if (this.postRunPending) {
				// 运行期间被请求过，复位标记并触发一次 schedule（会加 1 个单位延迟）
				this.postRunPending = false;
				this.scheduleSync();
			}
		}
	}
}
