import { produce } from "immer";
import { create } from "zustand";

// 单个实例的状态定义
type InstanceState<Value = any, Returned = any> = {
    visible: boolean;
    edit?: Value;
    controller?: {
        resolve: (val: Returned) => void;
        reject: (reason?: any) => void;
        promise: Promise<Returned>;
    };
};

// 全局 Store 的总状态
type GlobalConfirmState = {
    instances: Record<string, InstanceState>;
};

type GlobalConfirmActions = {
    // 初始化或打开弹窗
    open: <V, R>(id: string, value?: V) => Promise<R>;
    // 更新指定 ID 的状态
    update: (id: string, partial: Partial<InstanceState>) => void;
    // 清理/移除实例（防止内存泄漏）
    remove: (id: string) => void;
};

export const useGlobalConfirmStore = create<
    GlobalConfirmState & GlobalConfirmActions
>()((set, get) => ({
    instances: {},

    open: (id, value) => {
        const existing = get().instances[id]?.controller?.promise;
        if (existing) return existing;

        const { promise, reject, resolve } = Promise.withResolvers<any>();

        set(
            produce((state: GlobalConfirmState) => {
                state.instances[id] = {
                    visible: true,
                    edit: value,
                    controller: { resolve, reject, promise },
                };
            }),
        );

        return promise;
    },

    update: (id, partial) => {
        set(
            produce((state: GlobalConfirmState) => {
                if (state.instances[id]) {
                    Object.assign(state.instances[id], partial);
                }
            }),
        );
    },

    remove: (id) => {
        set(
            produce((state: GlobalConfirmState) => {
                delete state.instances[id];
            }),
        );
    },
}));
