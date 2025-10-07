import { type LocaleName, getBrowserLang } from "@/locale/utils";
import { create, type StateCreator } from "zustand";
import {
	type PersistOptions,
	createJSONStorage,
	persist,
} from "zustand/middleware";

type State = {
	locale: LocaleName;
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
