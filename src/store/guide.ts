import { create, type StateCreator } from "zustand";
import {
    createJSONStorage,
    type PersistOptions,
    persist,
} from "zustand/middleware";

type GuideStore = {
    // 搜索页筛选按钮提示气泡
    filterHintShows?: boolean;
    // 首页同步状态图标提示气泡
    cloudSyncHintShows?: boolean;
    // 首页预算提示
    dynamicPromotionIds?: string[];
    closedPromotionIds?: string[];
};

export type GuidePersistKey = keyof GuideStore;

type Persist<S> = (
    config: StateCreator<S>,
    options: PersistOptions<S>,
) => StateCreator<S>;

export const useGuideStore = create<GuideStore>()(
    (persist as Persist<GuideStore>)(
        (set, get) => {
            return {};
        },
        {
            name: "guide-store",
            storage: createJSONStorage(() => localStorage),
            version: 0,
            partialize(state) {
                return state;
            },
        },
    ),
);
