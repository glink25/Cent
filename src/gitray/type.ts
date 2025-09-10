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
	// _created_at: number;
	// _updated_at: number;
	_deleted_at?: string;
};

export type OutputType<T> = T;
