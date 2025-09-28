import { useShallow } from "zustand/shallow";
import { useLedgerStore } from "@/store/ledger";

export function useCreators() {
	const creators = useLedgerStore(
		useShallow((state) => state.infos?.creators ?? []),
	);
	return creators;
}
