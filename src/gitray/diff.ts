import type { FileLike, StoreStructure } from "./type";

const buildPathMap = (s?: StoreStructure): Map<string, string | undefined> => {
	const map = new Map<string, string | undefined>();
	if (!s) return map;

	const add = (f?: FileLike) => {
		if (!f || !f.path) return;
		// preserve first-seen insertion order; overwrite is ok but should not happen normally
		map.set(f.path, f.sha ?? undefined);
	};

	add(s.meta);
	for (const col of s.collections || []) {
		add(col.meta);
		for (const ch of col.chunks || []) add(ch);
		for (const ch of col.assets || []) add(ch);
	}

	return map;
};

/**
 * 返回 [changedPaths, deletedPaths]
 * - changedPaths: 在 b 中存在且 (a 中不存在 或 sha 不同) 的 path
 * - deletedPaths: 在 a 中存在但在 b 中不存在的 path
 */
export const diff = (
	a: StoreStructure,
	b: StoreStructure,
): [string[], string[]] => {
	const aMap = buildPathMap(a);
	const bMap = buildPathMap(b);

	// changed = paths in b that are new or have different sha compared to a
	const changedPaths: string[] = [];
	for (const [path, bSha] of bMap) {
		const aSha = aMap.get(path);
		// treat undefined sha as different (conservative)
		if (aSha !== bSha) {
			changedPaths.push(path);
		}
	}

	// deleted = paths in a that do not exist in b
	const deletedPaths: string[] = [];
	for (const path of aMap.keys()) {
		if (!bMap.has(path)) deletedPaths.push(path);
	}

	return [changedPaths, deletedPaths];
};
