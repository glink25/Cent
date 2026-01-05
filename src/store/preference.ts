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
    /** 是否禁用路由返回模式 */
    disableHashModeOnAndroidStandaloneMode?: boolean;
    /** 键盘高度百分比（基于最大和最小高度） */
    keyboardHeight?: number;
    /** 在账单列表中直接展示附件图片 */
    showAssetsInLedger?: boolean;
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

export const getEnableHashMode = () => {
    // 1. 判断是否为 iOS 设备 (iPhone, iPad, iPod)
    const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // 综合判断
    if (isIOS) {
        return false;
    }

    // 2. 判断是否处于 PWA 模式 (已添加到主屏幕并打开)
    const isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
    if (!isPWA) {
        return false;
    }
    const disabled =
        usePreferenceStore.getState().disableHashModeOnAndroidStandaloneMode;
    return !disabled;
};
