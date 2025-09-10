import { produce } from "immer";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLocalToken } from "@/api/login";
import { UserAPI } from "../api/user";

type UserStoreState = {
	avatar: string;
	login: string;
	name: string;
	id: number;
	loading: boolean;
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
			const loading = Boolean(getLocalToken());
			const updateUserInfo = async () => {
				await Promise.resolve();
				set(
					produce((state) => {
						state.loading = true;
					}),
				);
				try {
					const res = await UserAPI.getUserInfo();
					set(
						produce((state: UserStore) => {
							state.avatar = res.avatar_url;
							state.login = res.login;
							state.name = res.name;
							state.id = res.id;
						}),
					);
				} finally {
					set(
						produce((state) => {
							state.loading = false;
						}),
					);
				}
			};
			updateUserInfo();
			return {
				loading,
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
