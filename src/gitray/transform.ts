import type { BaseItem } from "./type";

export const omitAssets = <Item extends BaseItem>(
	items: Item[],
	transformer: (file: File) => [string, string],
) => {
	const assets: { path: string; file: File }[] = [];
	const newItems = items.map((item) => {
		const entries = Array.from(Object.entries(item)).map(([k, v]) => {
			if (v instanceof File) {
				const [absPath, relativePath] = transformer(v);
				assets.push({ path: relativePath, file: v });
				return [k, absPath];
			}
			return [k, v];
		});

		return Object.fromEntries(entries);
	});
	return {
		items: newItems,
		assets,
	};
};
