import { produce } from "immer";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserAPI } from "../api/user";

type UserStoreState = {
	avatar: string;
	login: string;
	name: string;
	id: number;
};

type UserStoreActions = {
	updateUserInfo: () => Promise<void>;
};

type UserStore = UserStoreState & UserStoreActions;

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

export const useUserStore = create<UserStore>()(
	(persist as Persist<UserStore>)(
		(set) => {
			const updateUserInfo = async () => {
				const res = await UserAPI.getUserInfo();
				set(
					produce((state: UserStore) => {
						state.avatar = res.avatar_url;
						state.login = res.login;
						state.name = res.name;
						state.id = res.id;
					}),
				);
			};
			updateUserInfo();
			return {
				avatar: "",
				login: "",
				name: "",
				id: -1,
				updateUserInfo,
			};
		},
		{
			name: "user-store",
			storage: createJSONStorage(() => localStorage),
			version: 0,
		},
	),
);
