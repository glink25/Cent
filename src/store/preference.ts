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
    /** 在首页条目中显示附件缩略图 */
    showAttachmentsInList?: boolean;
    enterAddBillWhenReduceMotionChanged?: boolean;
    readClipboardWhenReduceMotionChanged?: boolean;
    smartPredict?: boolean;
    multiplyKey?: string;
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
            return {
                locale: getBrowserLang(),
                autoLocateWhenAddBill: false,
                showAttachmentsInList: false,
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
