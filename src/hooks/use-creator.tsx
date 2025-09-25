import { useLedgerStore } from "@/store/ledger";
import { useShallow } from "zustand/shallow";

export function useCreators() {
	const creators = useLedgerStore(
		useShallow((state) => state.infos?.creators ?? []),
	);
	return creators;
}
