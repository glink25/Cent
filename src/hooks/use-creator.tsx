import { useEffect, useState } from "react";
import type { PersonalMeta } from "@/api/storage";
import type { UserInfo } from "@/api/user";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

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
	const { infos } = useLedgerStore();
	const [creators, setCreators] =
		useState<Record<string | number, { meta: PersonalMeta; info: UserInfo }>>({});
	useEffect(() => {
		infos?.creators?.forEach((c) => {
			fetchUser(c.id).then((u) => {
				setCreators((v) => ({ ...v, [c.id]: { meta: c.meta, info: u } }));
			});
		});
	}, [infos?.creators?.forEach]);

	return creators
}
