import { useCallback } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import type { BillTag } from "@/components/bill-tag/type";

export function useTag() {
	const tags = useLedgerStore(
		useShallow((state) => state.infos?.meta.tags ?? []),
	);
	const add = useCallback(async (newTag: Omit<BillTag, "id">) => {
		const { promise, resolve, reject } = Promise.withResolvers<string>();
		const book = useBookStore.getState().currentBookId;
		if (!book) {
			reject("no book");
			return promise;
		}
		await useLedgerStore.getState().updateGlobalMeta((prev) => {
			if (prev.tags?.some((t) => t.name === newTag.name)) {
				reject("tag name already exist");
				return prev;
			}
			if (prev.tags === undefined) {
				prev.tags = [];
			}
			const id = v4();
			prev.tags.push({ ...newTag, id });
			resolve(id);
			return prev;
		});
		return promise;
	}, []);

	const update = useCallback(
		async (id: string, value?: Omit<BillTag, "id">) => {
			const book = useBookStore.getState().currentBookId;
			if (!book) {
				return;
			}
			await useLedgerStore.getState().updateGlobalMeta((prev) => {
				if (prev.tags === undefined) {
					return prev;
				}
				if (value === undefined) {
					prev.tags = prev.tags.filter((v) => v.id !== id);
					return prev;
				}
				const index = prev.tags.findIndex((v) => v.id === id);
				if (index === -1) {
					return prev;
				}
				prev.tags[index] = { id, ...value };
				return prev;
			});
		},
		[],
	);

	const reorder = useCallback(async (orderedTags: Pick<BillTag, "id">[]) => {
		await useLedgerStore.getState().updateGlobalMeta((prev) => {
			const newTags = orderedTags
				.map((t) => prev.tags.find((v) => v.id === t.id))
				.filter((v) => v !== undefined);
			prev.tags = newTags;
			return prev;
		});
	}, []);

	return {
		tags,
		add,
		update,
		reorder,
	};
}
