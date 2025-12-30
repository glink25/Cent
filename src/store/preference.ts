import { create, type StateCreator } from "zustand";
import {
    createJSONStorage,
    type PersistOptions,
    persist,
} from "zustand/middleware";
import { getBrowserLang, type LocaleName } from "@/locale/utils";

type State = {
    locale: LocaleName;
    autoLocateWhenAddBill?: boolean;
    enterAddBillWhenReduceMotionChanged?: boolean;
    readClipboardWhenReduceMotionChanged?: boolean;
    smartPredict?: boolean;
    multiplyKey?: string;
    /** 键盘高度百分比（基于最大和最小高度） */
    keyboardHeight?: number;
    /** @deprecated */
    quickEntryWithReLayr?: boolean;
    /** @deprecated */
    reLayrPort?: string;
    /** @deprecated */
    reLayrKey?: string;
};
type Store = State;

type Persist<S> = (
    config: StateCreator<S>,
    options: PersistOptions<S>,
) => StateCreator<S>;

export const usePreferenceStore = create<Store>()(
    (persist as Persist<Store>)(
        (set, get) => {
            const init = async () => {
                await Promise.resolve();
                const registerKeyboardHeight = () => {
                    const h = get().keyboardHeight;
                    document.body.style.setProperty(
                        "--bekh",
                        h ? `${h / 100}` : "0.5",
                    );
                };

                usePreferenceStore.subscribe((current, prev) => {
                    if (prev.keyboardHeight !== current.keyboardHeight) {
                        registerKeyboardHeight();
                    }
                });
                registerKeyboardHeight();
            };
            init();
            return {
                locale: getBrowserLang(),
                autoLocateWhenAddBill: false,
                readClipboardWhenReduceMotionChanged: false,
                smartPredict: false,
                reLayrKey: "cent",
                reLayrPort: "2525",
            };
        },
        {
            name: "preference-store",
            storage: createJSONStorage(() => localStorage),
            version: 0,
        },
    ),
);

export const usePreference = <K extends keyof Store>(
    key: K,
): [Store[K], (value: Store[K]) => void] => {
    const value = usePreferenceStore((state) => state[key]);
    const setValue = (val: Store[K]) => {
        usePreferenceStore.setState({ [key]: val } as Partial<Store>);
    };
    return [value, setValue];
};
