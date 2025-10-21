import { produce } from "immer";
import { create } from "zustand";

type ConfirmStoreState<Value, Returned = Value> = {
    visible: boolean;
    edit?: Value;
    controller?: PromiseWithResolvers<Returned>;
};

type ConfirmStoreAction<Value, Returned = Value> = {
    open: (value?: Value) => Promise<Returned>;
    update: (v: ConfirmStoreState<Value>) => void;
};

type ConfirmStore<Value, Returned = Value> = ConfirmStoreState<
    Value,
    Returned
> &
    ConfirmStoreAction<Value, Returned>;

export const confirmStoreFactory = <Value, Returned = Value>() => {
    const useStore = create<ConfirmStore<Value, Returned>>()((set, get) => {
        return {
            visible: false,
            open: (v) => {
                const last = get().controller?.promise;
                if (last) {
                    return last;
                }
                const { promise, reject, resolve } =
                    Promise.withResolvers<Returned>();

                set(
                    produce((state) => {
                        state.visible = true;
                        state.edit = v;
                        state.controller = { reject, resolve, promise };
                    }),
                );
                return promise;
            },
            update: (v: ConfirmStoreState<Value>) => {
                set(
                    produce((state) => {
                        Object.assign(state, v);
                    }),
                );
            },
        };
    });
    return useStore;
};
