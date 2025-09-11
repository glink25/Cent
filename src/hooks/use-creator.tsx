import { useEffect, useState } from "react";
import type { UserInfo } from "@/api/user";
import { useUserStore } from "@/store/user";

const cache = new Map<string | number, Promise<UserInfo>>();

export function useCreator(login: string | number) {
	const [info, setInfo] = useState<UserInfo>();
	useEffect(() => {
		const promise =
			cache.get(login) ??
			(() => {
				const p = useUserStore.getState().getUserInfo(login);
				cache.set(login, p);
				return p;
			})();
		promise.then((v) => {
			setInfo(v);
		});
	}, [login]);

	return info ?? { login, name: "..." };
}
