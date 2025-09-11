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
