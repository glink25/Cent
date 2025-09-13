import type { DBSchema } from "idb";
import type { ITEM_STORE_NAME, META_STORE_NAME, STASH_STORE_NAME } from "./consts";

export type FileLike = { path: string; sha: string };

export type Meta = { [key: string]: any };

export type StoreStructure = {
	collections: {
		name: string;
		meta: FileLike;
		chunks: FileLike[];
		assets: FileLike[];
	}[];
	meta: FileLike;
};

export type StoreDetail<Item extends BaseItem> = {
	collections: {
		name: string;
		meta: FileLike & { content: Meta; file?: File };
		chunks: (FileLike & { content: Item[]; file?: File })[];
		assets: (FileLike & { file: File })[];
	}[];
	meta: FileLike & { content: any; file?: File };
};

export type BaseItem = {
	id: string;
	[key: string]: any;
};

export type OutputType<T> = T;

export type BaseItemAction<T extends BaseItem> =
	| {
		type: "add";
		collection: string;
		store: string;
		params: T;
	}
	| {
		type: "remove";
		collection: string;
		store: string;
		params: T["id"];
	}
	| {
		type: "update";
		collection: string;
		store: string;
		params: { id: T["id"]; changes: Partial<T> };
	};

export type ItemAction<T extends BaseItem> = BaseItemAction<T> & { id: string };

export type BaseMetaAction<M = any> = {
	type: "meta";
	collection: string | undefined;
	store: string;
	params: M;
};

export type MetaAction<M = any> = BaseMetaAction<M> & { id: string };

export type Action<T extends BaseItem, M = any> = ItemAction<T> | MetaAction<M>;

export type Full<T extends BaseItem> = T & {
	__store: string;
	__collection: string;
	__updated_at: number;
	__created_at: number;
	__deleted_at?: string;
};

export type IndexKeys = { [s: string]: IDBValidKey };
export interface GitrayDBSchema<Item extends BaseItem, ItemIndexes extends IndexKeys>
	extends DBSchema {
	[STASH_STORE_NAME]: {
		key: string;
		value: Action<Full<Item>>;
	};
	[META_STORE_NAME]: {
		key: string;
		value: { path: string; value: Meta };
		indexes: {
			path: string;
		};
	};
	[ITEM_STORE_NAME]: {
		key: string;
		value: Full<Item>;
		indexes: {
			id: string;
			__store: string;
			__store___created_at: string;
		} & ItemIndexes;
	};
}