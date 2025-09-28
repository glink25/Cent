import { produce } from "immer";
import { toast } from "sonner";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLocalToken, LoginAPI } from "@/api/login";
import { t } from "@/locale";
import { UserAPI, type UserInfo } from "../api/user";

type UserStoreState = {
	avatar_url: string;
	login: string;
	name: string;
	id: number | string;
	loading: boolean;
	expired?: boolean;
	cachedUsers: Record<string, UserInfo>;
	cachedCollaborators: Record<string, UserInfo[]>;
};

type UserStoreActions = {
	updateUserInfo: () => Promise<void>;

	getUserInfo: (login: string | number) => Promise<UserInfo>;
	getCollaborators: (repo: string) => Promise<UserInfo[]>;
};

type UserStore = UserStoreState & UserStoreActions;

type Persist<S> = (
	config: StateCreator<S>,
	options: PersistOptions<S>,
) => StateCreator<S>;

export const useUserStore = create<UserStore>()(
	(persist as Persist<UserStore>)(
		(set, get) => {
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
							state.avatar_url = res.avatar_url;
							state.login = res.login;
							state.name = res.name;
							state.id = res.id;
							state.expired = undefined;
						}),
					);
				} catch (error) {
					if ((error as any)?.status === "401") {
						toast.error(
							t("token-expired-please-re-login-to-github-from-setting-page"),
							{
								position: "top-center",
								action: {
									label: t("re-login"),
									onClick: () => {
										LoginAPI.login();
									},
								},
							},
						);
					}
					set(
						produce((state: UserStore) => {
							state.expired = true;
						}),
					);
					throw error;
				} finally {
					set(
						produce((state) => {
							state.loading = false;
						}),
					);
				}
			};

			updateUserInfo();

			const getUserInfo = async (login: string | number) => {
				const run = async () => {
					const res = await UserAPI.getUserInfo(login);
					const info = {
						avatar_url: res.avatar_url,
						login: res.login,
						name: res.name,
						id: res.id,
					};
					set(
						produce((state: UserStore) => {
							state.cachedUsers[login] = info;
						}),
					);
					return res;
				};
				const cachedUsers = get().cachedUsers;
				if (cachedUsers[login]) {
					run();
					return cachedUsers[login];
				}

				return run();
			};

			const getCollaborators = async (repo: string) => {
				const run = async () => {
					const res = await UserAPI.getCollaborators(repo);
					set(
						produce((state: UserStore) => {
							state.cachedCollaborators[repo] = res;
						}),
					);
					return res;
				};
				const cachedCollaborators = get().cachedCollaborators;
				if (cachedCollaborators[repo]) {
					run();
					return cachedCollaborators[repo];
				}
				return run();
			};
			return {
				loading,
				avatar_url: "",
				login: "",
				name: "",
				id: -1,
				updateUserInfo,
				getUserInfo,
				getCollaborators,
				cachedUsers: {},
				cachedCollaborators: {},
			};
		},
		{
			name: "user-store",
			storage: createJSONStorage(() => localStorage),
			version: 0,
		},
	),
);
