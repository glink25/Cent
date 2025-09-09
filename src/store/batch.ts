import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
	BaseItem,
	BatchOperations,
	Gitray,
	InputType,
} from "@/gitray/index";

interface BatchState<T extends BaseItem> {
	// 当前待处理的操作
	pendingOperations: BatchOperations<T>;
	// 当前正在执行的操作
	processingOperations: BatchOperations<T> | null;
	// 是否正在执行batch
	isBatching: boolean;
	// 计时器ID
	batchTimer: NodeJS.Timeout | null;
	// 操作方法
	addItem: (repoFullName: string, item: InputType<T>) => void;
	updateItem: (
		repoFullName: string,
		itemId: string,
		changes: Partial<InputType<T>>,
	) => void;
	removeItem: (repoFullName: string, itemId: string) => void;
	// 内部方法
	_clearTimer: () => void;
	_setBatchTimer: (timer: NodeJS.Timeout) => void;
	_setPendingOperations: (operations: BatchOperations<T>) => void;
	_setProcessingOperations: (operations: BatchOperations<T> | null) => void;
	_setIsBatching: (isBatching: boolean) => void;
	_scheduleBatch: () => void;
	_triggerBatch: () => void;
	// 添加初始化方法
	_initializeStore: () => void;
}

export const createBatchStore = create<BatchState<T>>()(
	persist(
		(set, get) => {
			return {};
		},
		{
			name: `batch-store`, // 持久化存储的唯一名称
			version: 1, // 版本号，用于未来的数据结构迁移
			// 只持久化必要的状态
			partialize: (state) => ({
				pendingOperations: state.pendingOperations,
				processingOperations: state.processingOperations,
			}),
		},
	),
);
