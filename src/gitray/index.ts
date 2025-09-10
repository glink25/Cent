/**
 * 这是一个用于将Github作为持久化存储数据库存储数据的 browser-based lib
 * 它通过本地indexedDB进行实时的数据修改操作，然后记录所有的更改，并将修改延迟同步到指定的github仓库
 * 基础概念：
 * Gitray中一个 Store 代表一个Github仓库，通过Github仓库名来判断是否是一个Store
 * 一个Store可以包含多条Collection
 * Collection为可以被indexedDB存储的数据，包括File对象
 * 一个Store的Github仓库文件结构如下：
 * user/gitray-store    仓库名称/store名称
 * -- meta.json         存储全局元数据信息
 * -- /collection-a     collection名称
 * ---- entry-001.json  分块存储collection数据
 * ---- meta.json       collection元数据信息
 * -- assets/           二进制文件存储目录
 * ---- uid-a.jpg       collection中携带的二进制文件
 */

import { type IDBPDatabase, openDB } from "idb";
import { Octokit } from "octokit";
import { getCurrentVersion, getOrCreateStore } from "./db";
import { Scheduler } from "./scheduler";
import { computeGitBlobSha1 } from "./sha";
import type {
	BaseItem,
	FileLike,
	Meta,
	StoreDetail,
	StoreStructure,
} from "./type";

export interface GitrayConfig {
	/**
	 * Dynamically provides authentication tokens. It's called before each API request.
	 * 必须具备读写仓库的权限 (repo scope).
	 */
	auth: () => Promise<{ accessToken: string; refreshToken?: string }>;
	/** 本地indexedDB实例名称
	 * @default 'local-gitray'
	 */
	dbName?: string;
	/**
	 * (可选) 用于识别和筛选本 lib 所管理的仓库的统一前缀
	 * @default 'gitray-db'
	 */
	repoPrefix?: string;

	/**
	 * 要操作的集合的名称 (e.g., 'entries', 'posts').
	 * 一个客户端实例将专门操作此名称的集合。
	 *  @default 'entry'
	 */
	entryName?: string;
	itemsPerChunk?: number;
	deletionStrategy?: "hard" | "soft";
}

export type ItemAction<T extends BaseItem> =
	| {
			id: string;
			type: "add";
			collection: string;
			store: string;
			params: T;
	  }
	| {
			id: string;
			type: "remove";
			collection: string;
			store: string;
			params: T["id"];
	  }
	| {
			id: string;
			type: "update";
			collection: string;
			store: string;
			params: { id: T["id"]; changes: Partial<T> };
	  };

export type MetaAction<M = any> = {
	id: string;
	type: "meta";
	collection: string | undefined;
	store: string;
	params: M;
};

export type Action<T extends BaseItem, M = any> = ItemAction<T> | MetaAction<M>;

export type Processor = (finished: Promise<void>) => void;

export type ChangeListener = (args: {
	store: string;
	collection?: string;
}) => void;

const STASH_STORE_NAME = "__stash";
const META_STORE_NAME = "__meta";

type ITEM_STORE_NAME__HELPER = "__item";

type GitrayDB<Item extends BaseItem> = {
	[STASH_STORE_NAME]: Action<Item>[];
	[META_STORE_NAME]: { id: string; value: Meta };
} & { __item: Item[] };

type GitTreeItem = {
	path?: string;
	mode?: "100644" | "100755" | "040000" | "160000" | "120000";
	type?: "blob" | "tree" | "commit";
	sha?: string | null;
	content?: string;
};

export class Gitray<Item extends BaseItem> {
	private readonly config: Required<GitrayConfig>;
	private userInfo?: { id: number; login: string };

	constructor(config: GitrayConfig) {
		this.config = {
			dbName: "local-gitray",
			repoPrefix: "gitray-db",
			entryName: "entry",
			itemsPerChunk: 2000,
			deletionStrategy: "hard",
			...config,
		};
		// this.getDB().then((db) => db.close());
		getOrCreateStore(this.config.dbName, STASH_STORE_NAME, {
			keyPath: "id",
		}).then((db) => {
			db.close();
			getOrCreateStore(this.config.dbName, META_STORE_NAME, {
				keyPath: "id",
			}).then((db) => {
				db.close();
			});
		});
	}

	private async getDB() {
		const currentVersion = await getCurrentVersion(this.config.dbName);
		console.log(currentVersion, "cccv");
		return openDB<GitrayDB<Item>>(`${this.config.dbName}`, currentVersion, {
			upgrade(db) {
				console.log(db.objectStoreNames, "storenames");
				// Create stores if they don't exist
				if (!db.objectStoreNames.contains(STASH_STORE_NAME)) {
					db.createObjectStore(STASH_STORE_NAME, { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains(META_STORE_NAME)) {
					db.createObjectStore(META_STORE_NAME);
				}
			},
		});
	}

	private async getOctokit(): Promise<Octokit> {
		const { accessToken } = await this.config.auth();
		return new Octokit({ auth: accessToken });
	}

	private async getUserInfo(): Promise<{ id: number; login: string }> {
		if (!this.userInfo) {
			const octokit = await this.getOctokit();
			const { data } = await octokit.request("GET /user");
			this.userInfo = { id: data.id, login: data.login };
		}
		return this.userInfo;
	}

	/**
	 * 获取store中所有的collection name
	 */
	private async fetchStoreStructure(
		storeFullName: string,
	): Promise<StoreStructure> {
		const octokit = await this.getOctokit();
		const [owner, repo] = storeFullName.split("/");
		if ([owner, repo].some((v) => v.length === 0))
			throw new Error(`invalid store name: ${storeFullName}`);
		const { entryName } = this.config;

		// Step 1: Get ref to the latest commit on the default branch
		const { data: repoData } = await octokit.request(
			"GET /repos/{owner}/{repo}",
			{ owner, repo },
		);
		const { data: refData } = await octokit.request(
			"GET /repos/{owner}/{repo}/git/ref/{ref}",
			{ owner, repo, ref: `heads/${repoData.default_branch}` },
		);
		const latestCommitSha = refData.object.sha;

		// Step 2: Get the commit to find the root tree SHA
		const { data: commitData } = await octokit.request(
			"GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
			{ owner, repo, commit_sha: latestCommitSha },
		);
		const treeSha = commitData.tree.sha;

		// Step 3: Get the repo's file tree recursively. This avoids CORS issues with non-existent /contents/ paths.
		const { data: treeData } = await octokit.request(
			"GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
			{
				owner,
				repo,
				tree_sha: treeSha,
				recursive: "true",
			},
		);

		// Step 4: Filter the tree to find our specific chunk files
		const chunkFiles = treeData.tree.filter(
			(file) =>
				!!file.path && file.type === "blob" && file.path.endsWith(".json"),
		);
		// Convert chunkFiles to StoreStructure
		const structure: StoreStructure = {
			collections: [],
			meta: { path: "meta.json", sha: "" },
		};

		const metaFile = chunkFiles.find((f) => f.path === "meta.json");
		if (metaFile) {
			structure.meta = { path: metaFile.path, sha: metaFile.sha };
		}

		// Group files by collection
		const collections = new Map<
			string,
			{
				meta: FileLike;
				chunks: FileLike[];
			}
		>();

		chunkFiles.forEach((file) => {
			const pathParts = file.path.split("/");
			if (pathParts.length === 1) return; // Skip root level files

			const collectionName = pathParts[0];
			if (!collections.has(collectionName)) {
				collections.set(collectionName, {
					meta: { path: `${collectionName}/meta.json`, sha: "" },
					chunks: [],
				});
			}

			const collection = collections.get(collectionName)!;
			if (pathParts[1] === "meta.json") {
				collection.meta = { path: file.path, sha: file.sha };
			} else if (pathParts[1].startsWith(entryName)) {
				collection.chunks.push({ path: file.path, sha: file.sha });
			}
		});

		structure.collections = Array.from(collections.entries()).map(
			([name, data]) => ({
				name,
				meta: data.meta,
				chunks: data.chunks.sort((a, b) => a.path.localeCompare(b.path)),
			}),
		);

		return structure;
	}

	private async fetchStoreDetail(
		storeFullName: string,
		_structure?: StoreStructure,
	) {
		const [owner, repo] = storeFullName.split("/");
		if ([owner, repo].some((v) => v.length === 0))
			throw new Error(`invalid store name: ${storeFullName}`);
		const octokit = await this.getOctokit();
		const structure =
			_structure === undefined
				? await this.fetchStoreStructure(storeFullName)
				: _structure;
		console.log(structure);
		// const results =
		await Promise.all(
			[
				structure.meta,
				...structure.collections.flatMap((c) => [c.meta, c.chunks]),
			]
				.flat()
				.map(async (file) => {
					console.log(file, "ssfile");
					if (!file.path || !file.sha) {
						return;
					}
					const { data: content } = await octokit.request(
						"GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
						{ owner, repo, file_sha: file.sha },
					);
					const chunkData = JSON.parse(atob(content.content)) as any[];
					(file as any).content = chunkData;
					return { content: chunkData, path: file.path };
				}),
		);
		// const detail = { ...structure } as StoreDetail<Item>;
		// detail.meta.content=results.map()
		console.log(structure, "struc");
		return structure as StoreDetail<Item>;
	}

	async getStash() {
		const db = await this.getDB();
		const stashStore = db
			.transaction(STASH_STORE_NAME)
			.objectStore(STASH_STORE_NAME);
		const stashed = await stashStore.getAll();
		return stashed as Action<Item>[];
	}

	// public methods

	/** 根据名字创建一个store
	 * 根据repoPrefix确定store的名称
	 * 在本地indexedDB 中创建一个对应名称的
	 * 同步在github上创建一个对应名称的repo，并新建一个README.md文件进行仓库初始化
	 */
	async createStore(name: string): Promise<{ fullName: string; name: string }> {
		const { login: owner } = await this.getUserInfo();
		const storeName = `${this.config.repoPrefix}-${name}`;
		const octokit = await this.getOctokit();
		await octokit.request("POST /user/repos", {
			name: storeName,
			private: true,
		});
		await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
			owner,
			repo: storeName,
			path: "meta.json",
			message: "Initial commit by Gitray",
			content: btoa(JSON.stringify({})), // btoa is for browser environment
		});
		return { fullName: `${owner}/${storeName}`, name: storeName };
	}

	/**
	 * 获取所有符合repoPrefix的仓库名称
	 */
	async fetchAllStore() {
		const octokit = await this.getOctokit();
		const repos = await octokit.paginate("GET /user/repos", { type: "all" });
		console.log(this.config.repoPrefix, "ppp");
		return repos
			.filter((repo) => repo.name.startsWith(this.config.repoPrefix))
			.map((repo) => repo.full_name);
	}

	/**
	 * 批量操作指定的 collection （增删改）
	 * 如果collection不存在则会创建对应的collection
	 * @param storeFullName store的全名，包含login/前缀
	 * @param collection collection名称
	 */
	async batch(actions: Omit<Action<Item>, "id">[]): Promise<void> {
		const db = await this.getDB();
		const store = db
			.transaction(STASH_STORE_NAME, "readwrite")
			.objectStore(STASH_STORE_NAME);

		for (const action of actions) {
			// Store in stash for later sync
			await store.put({
				...action,
				id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
			});
		}
		db.close();
		this.scheduleSync();
		Array.from(new Set(actions.map((ac) => ac.store))).forEach((store) => {
			this.notifyChange(store);
		});
	}

	async initStore(storeFullName: string) {
		const detail = await this.fetchStoreDetail(storeFullName);
		const db = await this.getDB();
		const metaStore = db
			.transaction(META_STORE_NAME, "readwrite")
			.objectStore(META_STORE_NAME);

		await metaStore.put({
			id: storeFullName,
			value: detail.meta.content,
		});
		db.close();

		// Store collections
		for (const collection of detail.collections) {
			const key = `${storeFullName}/${collection.name}`;
			await metaStore.put({
				id: key,
				value: collection.meta.content,
			});
			const db = await getOrCreateStore<GitrayDB<Item>>(
				this.config.dbName,
				key,
				{
					keyPath: "id",
				},
			);
			// Store items
			for (const chunk of collection.chunks) {
				for (const item of chunk.content) {
					const itemStore = db
						.transaction(key as ITEM_STORE_NAME__HELPER, "readwrite")
						.objectStore(key as ITEM_STORE_NAME__HELPER);
					await itemStore.put(item);
				}
				db.close();
			}
		}

		this.notifyChange(storeFullName);
		return detail;
	}

	/**
	 * 获取指定collection的所有item
	 * @param storeFullName store的全名，包含login/前缀
	 * @param collection collection名称
	 * @param withStash 是否要与本地的stash合并
	 */
	async getAllItems(
		storeFullName: string,
		withStash: boolean = false,
	): Promise<(Item & { collection: string })[]> {
		const db = await this.getDB();
		const collectionNames = Array.from(db.objectStoreNames).filter((name) =>
			name.startsWith(storeFullName),
		);
		console.log(collectionNames, "all items");

		const promises = (await Promise.all(
			collectionNames.map((name) =>
				db
					.transaction(name as ITEM_STORE_NAME__HELPER)
					.objectStore(name as ITEM_STORE_NAME__HELPER)
					.getAll(),
			),
		)) as unknown as Item[][];
		const localItems = promises.flatMap((v, i) =>
			v.map((c) => ({ ...c, collection: pathToName(collectionNames[i]) })),
		);

		if (withStash) {
			const stashed = await this.getStash();
			console.log(stashed, "stashed", promises);
			applyStash(
				localItems,
				stashed
					.filter((ac) => ac.type !== "meta")
					.filter((ac) => storeFullName === ac.store),
			);
			console.log(localItems, "stashed local");
			return localItems;
		}

		return localItems;
	}

	async getMeta(
		storeFullName: string,
		collectionName?: string,
		withStash: boolean = false,
	) {
		const db = await this.getDB();
		const metaId = `${storeFullName}${collectionName ? `/${collectionName}` : ""}`;
		const localMeta = (await db.get(META_STORE_NAME, metaId))?.value || {};
		db.close();
		if (withStash) {
			const stashed = await this.getStash();
			const metaStashes = stashed
				.filter((ac) => ac.type === "meta")
				.filter((ac) => {
					if (storeFullName !== ac.store) return false;
					return collectionName === ac.collection;
				});
			return metaStashes[metaStashes.length - 1]?.params || localMeta;
		}
		return localMeta;
	}

	private async syncImmediate() {
		const stashed = await this.getStash();
		if (stashed.length === 0) return;

		const stores = Array.from(new Set(stashed.map((a) => a.store)));

		for (const store of stores) {
			const [owner, repo] = store.split("/");
			const octokit = await this.getOctokit();
			const actions = stashed.filter((ac) => ac.store === store);
			const remoteDetail = await this.fetchStoreDetail(store);

			const localItems = await this.getAllItems(store);

			const newItems = applyStash(
				localItems,
				actions.filter((ac) => ac.type !== "meta"),
			);
			console.log(localItems, "local");
			const collections = newItems.reduce(
				(p, c) => {
					if (p[c.collection] === undefined) {
						p[c.collection] = [];
					}
					p[c.collection].push(c);
					return p;
				},
				{} as Record<string, Item[]>,
			);

			const localDetail: StoreDetail<Item> = {
				collections: await Promise.all(
					Array.from(Object.entries(collections)).map(
						async ([collection, items]) => {
							const chunks: StoreDetail<Item>["collections"][number]["chunks"] =
								[];
							for (
								let i = 0;
								i < items.length;
								i += this.config.itemsPerChunk
							) {
								const con = items.slice(i, i + this.config.itemsPerChunk);
								const path = `${collection}/${this.config.entryName}-${i}.json`;
								const file = new File(
									[new Blob([JSON.stringify(con, null, 2)])],
									pathToName(path),
								);
								chunks.push({
									file,
									content: con,
									sha: await computeGitBlobSha1(file),
									path,
								});
							}
							const metaPath = `${collection}/meta.json`;
							const metaContent = (await this.getMeta(store, collection)) || {};
							console.log(metaContent, "metacontent");
							const metaFile = new File(
								[new Blob([JSON.stringify(metaContent, null, 2)])],
								pathToName(metaPath),
							);
							return {
								chunks: chunks,
								meta: {
									path: metaPath,
									sha: await computeGitBlobSha1(metaFile),
									content: metaContent,
									file: metaFile,
								},
								name: collection,
							};
						},
					),
				),
				meta: await (async () => {
					const content = (await this.getMeta(store)) || {};
					console.log(content, "metacontent");
					const metaPath = `meta.json`;
					const metaFile = new File(
						[new Blob([JSON.stringify(content, null, 2)])],
						pathToName(metaPath),
					);
					return {
						path: metaPath,
						sha: await computeGitBlobSha1(metaFile),
						content,
					};
				})(),
			};

			const [changedPaths, deletedPaths] = diff(remoteDetail, localDetail);
			console.log(changedPaths, "cahnged paths");
			const allFiles = toFiles(localDetail);
			const treePayload: GitTreeItem[] = await Promise.all([
				...changedPaths.map(async (path) => {
					const content = allFiles[path];
					console.log(content, "content h");
					const file =
						content.file ??
						new File(
							[new Blob([JSON.stringify(content.content, null, 2)])],
							pathToName(path),
						);
					const base64Content = await blobToBase64(file);
					const { data: blob } = await octokit.request(
						"POST /repos/{owner}/{repo}/git/blobs",
						{ owner, repo, content: base64Content, encoding: "base64" },
					);
					return {
						path,
						mode: "100644" as const,
						type: "blob" as const,
						sha: blob.sha,
					};
				}),
			]);
			const { data: repoData } = await octokit.request(
				"GET /repos/{owner}/{repo}",
				{ owner, repo },
			);
			const { data: refData } = await octokit.request(
				"GET /repos/{owner}/{repo}/git/ref/{ref}",
				{ owner, repo, ref: `heads/${repoData.default_branch}` },
			);
			const { data: commitData } = await octokit.request(
				"GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
				{ owner, repo, commit_sha: refData.object.sha },
			);
			const baseTreeSha = commitData.tree.sha;
			const latestCommitSha = refData.object.sha;
			const { data: newTree } = await octokit.request(
				"POST /repos/{owner}/{repo}/git/trees",
				{ owner, repo, tree: treePayload, base_tree: baseTreeSha },
			);
			const { data: newCommit } = await octokit.request(
				"POST /repos/{owner}/{repo}/git/commits",
				{
					owner,
					repo,
					message: `[Gitray] Batch update for ${store}`,
					tree: newTree.sha,
					parents: [latestCommitSha],
				},
			);
			await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
				owner,
				repo,
				ref: `heads/${repoData.default_branch}`,
				sha: newCommit.sha,
			});

			console.log(actions, "accccc");
			for (let i = 0; i < actions.length; i++) {
				const action = actions[i];
				const storeName = `${action.store}/${action.collection}`;
				const db = await getOrCreateStore(this.config.dbName, storeName, {
					keyPath: "id",
				});
				console.log(db, action, storeName);
				if (action.type === "add") {
					await db.put(storeName, action.params);
				} else if (action.type === "remove") {
					await db.delete(storeName, action.params);
				} else if (action.type === "update") {
					await db.put(storeName, {
						...action.params.changes,
						id: action.params.id,
					});
				} else if (action.type === "meta") {
					const key = `${action.store}${action.collection ? `${action.collection}/` : "/"}meta.json`;
					await db.put(META_STORE_NAME, { id: key, value: action.params });
				}
				await db.delete(STASH_STORE_NAME, action.id);
				db.close();
				console.log("run out", action);
			}
		}
	}

	private syncProcessors: Processor[] = [];
	/**
	 * 同步状态处理
	 * 当batch被调用后，更新首先会被写入本地
	 * 一段时间后，Gitray会自动调用
	 * @param processor
	 */
	onSync(processor: (finished: Promise<void>) => void) {
		this.syncProcessors.push(processor);
		return () => {
			const i = this.syncProcessors.indexOf(processor);
			this.syncProcessors.splice(i, 1);
		};
	}
	private toSync() {
		const finished = this.syncImmediate();
		this.syncProcessors.forEach((p) => {
			p(finished);
		});
	}

	private scheduler = new Scheduler(() => this.toSync());
	private async scheduleSync() {
		this.scheduler.scheduleSync();
	}

	// onChange
	private changeListeners: ChangeListener[] = [];
	private notifyChange(storeFullName: string, collectionName?: string) {
		this.changeListeners.forEach((p) => {
			p({ store: storeFullName, collection: collectionName });
		});
	}
	/**
	 * 监听数据是否发生变化
	 */
	onChange(listener: ChangeListener) {
		this.changeListeners.push(listener);
		return () => {
			const i = this.changeListeners.indexOf(listener);
			this.changeListeners.splice(i, 1);
		};
	}
}

// utils
const pathToName = (path: string) => {
	const splitted = path.split("/");
	return splitted[splitted.length - 1];
};

const applyStash = <Item extends BaseItem>(
	target: Item[],
	stashed: ItemAction<Item>[],
) => {
	stashed.reduce((prev, ac) => {
		console.log(ac.type, ac.params, "acc");
		if (ac.type === "add") {
			prev.push({
				...ac.params,
				collection: ac.collection,
			});
			return prev;
		} else if (ac.type === "remove") {
			const index = prev.findIndex((b) => b.id === ac.params);
			if (index === -1) {
				return prev;
			}
			prev.splice(index, 1);
			return prev;
		} else if (ac.type === "update") {
			const index = target.findIndex((b) => b.id === ac.params.id);
			if (index === -1) {
				return prev;
			}
			prev[index] = {
				...prev[index],
				...ac.params.changes,
				collection: ac.collection,
			};
			return prev;
		}
		return prev;
	}, target);
	return target as (Item & { collection: string })[];
};

const diff = (a: StoreStructure, b: StoreStructure) => {
	console.log(a, b, "diffffffff");
	const changedPaths = [
		b.meta.path,
		b.collections.flatMap((c) => [c.meta.path, ...c.chunks.map((c) => c.path)]),
	].flat();
	return [changedPaths];
};

const toFiles = <Item extends BaseItem>(a: StoreDetail<Item>) => {
	return Object.fromEntries([
		[a.meta.path, a.meta] as const,
		...a.collections.flatMap((v) => [
			[v.meta.path, v.meta] as const,
			...v.chunks.map((c) => [c.path, c] as const),
		]),
	]);
};

// Helper function to convert File/Blob to Base64, required for GitHub API
async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			const base64 = dataUrl.split(",")[1];
			resolve(base64);
		};
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(blob);
	});
}

export type * from "./type";
