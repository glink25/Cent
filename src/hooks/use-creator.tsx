import { useEffect, useState } from "react";
import type { UserInfo } from "@/api/user";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { useShallow } from "zustand/shallow";

const cache = new Map<string | number, Promise<UserInfo>>();

const fetchUser = (login: string | number) =>
	cache.get(login) ??
	(() => {
		const p = useUserStore.getState().getUserInfo(login);
		cache.set(login, p);
		return p;
	})();

export function useCreator(login: string | number) {
	const [info, setInfo] = useState<UserInfo>();
	useEffect(() => {
		const promise = fetchUser(login);
		promise.then((v) => {
			setInfo(v);
		});
	}, [login]);

	return info ?? { login, name: "..." };
}

export function useCreators() {
	const creators = useLedgerStore(
		useShallow((state) => state.infos?.creators ?? []),
	);
	return creators;
}
