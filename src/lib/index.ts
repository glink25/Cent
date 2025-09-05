/**
 * @file oncent-db.ts
 * @author Oncent
 * @version 1.0.0
 * @license MIT
 *
 * @description
 * OncentDB - A TypeScript library for using GitHub repositories as a structured array database.
 * 这是一个客户端TypeScript库，它将GitHub仓库巧妙地用作一个简单、无服务器的数据库，专门用于存储、管理和共享结构化的数组数据。
 *
 * @origin-story (来源场景)
 * 本项目的灵感来源于一个纯前端记账应用 "Oncent" 的构想。最初的设计是：
 * 1. 一条记账记录 (Entry)。
 * 2. 多个 Entries 组成一个用户的账单 (Ledger)。
 * 3. 多个用户的 Ledgers 组成一本共享账本 (Journal)，对应一个GitHub仓库。
 * 为了将这个想法通用化，我们抽象出了这个库。它不仅仅能用于记账，还能用于任何需要在前端持久化和协作处理数组数据的场景（如博客文章、待办事项列表等），同时利用GitHub的协作功能天然地支持了数据共享。
 *
 * @core-concepts (核心概念)
 * 1.  **Repository as Database (仓库即数据库):** 每个GitHub仓库都被视为一个独立的数据库。通过 `repoFullName` ('owner/repo') 来定位。
 *
 * 2.  **Collection (集合):** 在每个仓库中，可以存储一个或多个数据集合。本库的客户端实例在初始化时会绑定一个 `collectionName` (例如 'entries')，之后的所有操作都将围绕这个名称的集合进行。
 *
 * 3.  **User-Scoped Data (用户数据隔离):** 在一个仓库内（特别是共享仓库中），每个协作者的数据都存储在以其GitHub用户ID命名的独立文件夹下 (例如 `/1234567/`)。这确保了不同用户的数据不会互相干扰，实现了天然的多租户隔离。
 *
 * 4.  **Chunking/Sharding (数据分片):** 为了避免单个JSON文件过大导致性能问题，一个集合内的所有数据项会根据 `itemsPerChunk` (默认为2000) 被自动分割成多个小的JSON文件 (例如 `entries-001.json`, `entries-002.json`)。这个过程对用户是完全透明的。
 *
 * 5.  **Asset Handling (附件处理):** 当用户在数据项中传入一个 `File` 对象时，本库会自动将其上传到对应用户目录下的 `assets` 文件夹中，并在原始数据项中将 `File` 对象替换为该文件在GitHub上的永久URL。支持通过 `uploader` 配置自定义上传逻辑。
 *
 * 6.  **Atomic Operations (原子性操作):** 所有的写入操作（增、删、改）都通过一个核心的 `_batch` 方法实现。该方法利用GitHub的Git Trees API，确保数据分片和文件附件的所有变更都在一次Git Commit中完成，保证了操作的原子性。
 *
 * 7.  **Dynamic Authentication (动态认证):** 身份验证不是通过一个静态的token，而是通过一个开发者提供的异步函数 `auth()` 来实现。本库在每次需要调用API前都会执行此函数，以获取最新的`accessToken`，从而完美支持token的刷新和动态获取。
 *
 * 8.  **Smart Caching (智能缓存):** 提供了内置的缓存机制，默认使用 IndexedDB 作为存储后端。缓存策略包括：
 *     - 自动缓存所有读取操作的结果
 *     - 写入操作后智能更新缓存（而不是简单地使其失效）
 *     - 可配置的缓存有效期（TTL）
 *     - 支持自定义缓存存储实现
 *     这显著减少了对 GitHub API 的请求次数，提升了应用性能。
 *
 * @example
 * ```typescript
 * // 1. 导入并初始化客户端
 * import { OncentDbClient, BaseItem, createIndexedDBStorage } from './oncent-db';
 *
 * const storage = await createIndexedDBStorage('my-app-cache');
 * const dbClient = new OncentDbClient({
 *   collectionName: 'posts',
 *   auth: async () => {
 *     // 在这里实现你的token获取和刷新逻辑
 *     return { accessToken: 'YOUR_GITHUB_PAT' };
 *   },
 *   cache: {
 *     storage,        // 使用 IndexedDB 缓存
 *     ttl: 300000,    // 5分钟缓存有效期
 *   }
 * });
 *
 * // ...rest of the example...
 * ```
 */

import { Octokit } from "octokit";
import { v4 as uuidv4 } from "uuid";

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

export interface CacheStorage {
	get(key: string): Promise<any | null>;
	set(key: string, value: any): Promise<void>;
	remove(key: string): Promise<void>;
}

// =================================================================
// PART 1: TYPE DEFINITIONS
// =================================================================

/**
 * 主客户端的配置选项
 */
export interface OncentDbClientConfig {
	/**
	 * Dynamically provides authentication tokens. It's called before each API request.
	 * 必须具备读写仓库的权限 (repo scope).
	 */
	auth: () => Promise<{ accessToken: string; refreshToken?: string }>;

	/**
	 * 要操作的集合的名称 (e.g., 'entries', 'posts').
	 * 一个客户端实例将专门操作此名称的集合。
	 */
	collectionName: string;

	/**
	 * (可选) 用于识别和筛选本 lib 所管理的仓库的统一前缀
	 * @default 'oncent-db-'
	 */
	repoPrefix?: string;

	/**
	 * 缓存配置
	 */
	cache?: {
		/**
		 * 自定义的缓存存储实现
		 */
		storage: CacheStorage;

		/**
		 * 缓存有效期（毫秒）
		 */
		ttl?: number;
	};
}

/**
 * 单次操作的配置选项
 */
export interface CollectionConfig {
	itemsPerChunk?: number;
	deletionStrategy?: "hard" | "soft";
	uploader?: (file: File) => Promise<string>;
}

export type BaseItem = { id: string; [key: string]: any; _deleted_at?: string };

export type InputType<T extends BaseItem> = {
	[P in keyof T]: T[P] | File;
};

export type OutputType<T extends BaseItem> = T;

export interface BatchOperations<T extends BaseItem> {
	adds?: InputType<T>[];
	updates?: { id: string; changes: Partial<InputType<T>> }[];
	removes?: string[];
}

/**
 * Type definition for a single item in a Git Tree.
 */
type GitTreeItem = {
	path?: string;
	mode?: "100644" | "100755" | "040000" | "160000" | "120000";
	type?: "blob" | "tree" | "commit";
	sha?: string | null;
	content?: string;
};

// =================================================================
// PART 2: THE UNIFIED ONCENT DB CLIENT
// =================================================================

/**
 * OncentDB 统一客户端.
 * 一个客户端实例在创建时会绑定一个 `collectionName`，之后所有操作都针对该名称的集合。
 */
export class OncentDbClient {
	private config: Required<
		Omit<OncentDbClientConfig, "collectionName" | "auth" | "cache">
	>;
	private readonly collectionName: string;
	private authProvider: () => Promise<{
		accessToken: string;
		refreshToken?: string;
	}>;
	private userInfo: { id: number; login: string } | null = null;

	private cache?: {
		storage: CacheStorage;
		ttl: number;
	};

	constructor(config: OncentDbClientConfig) {
		if (!config.collectionName) {
			throw new Error(
				"`collectionName` must be provided in OncentDbClientConfig.",
			);
		}
		if (typeof config.auth !== "function") {
			throw new Error(
				"`auth` must be a function that returns a Promise with accessToken.",
			);
		}
		this.collectionName = config.collectionName;
		this.authProvider = config.auth;
		this.config = {
			repoPrefix: "oncent-db-",
			...config,
		};

		if (config.cache) {
			this.cache = {
				storage: config.cache.storage,
				ttl: config.cache.ttl || 5 * 60 * 1000, // 默认5分钟
			};
		}
	}

	// ----------------------------------------------------------------
	// PRIVATE HELPERS
	// ----------------------------------------------------------------

	/**
	 * Dynamically creates an Octokit instance with the latest auth token.
	 */
	private async getOctokit(): Promise<Octokit> {
		const { accessToken } = await this.authProvider();
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

	private parseRepoFullName(repoFullName: string): {
		owner: string;
		repo: string;
	} {
		const parts = repoFullName.split("/");
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			throw new Error(
				`Invalid repoFullName format. Expected 'owner/repo', but got '${repoFullName}'.`,
			);
		}
		return { owner: parts[0], repo: parts[1] };
	}

	private async getCollectionContext(
		repoFullName: string,
		config: CollectionConfig = {},
	) {
		const { owner, repo } = this.parseRepoFullName(repoFullName);
		const userId = (await this.getUserInfo()).id;
		const finalConfig: Required<CollectionConfig> = {
			itemsPerChunk: 2000,
			deletionStrategy: "hard",
			uploader: async (file: File) => {
				throw new Error("Default uploader must be called via _batch context");
			},
			...config,
		};

		return {
			owner,
			repo,
			collectionPath: `${userId}/`,
			collectionName: this.collectionName,
			config: finalConfig,
		};
	}

	private getCacheKey(
		owner: string,
		repo: string,
		path: string,
		name: string,
	): string {
		return `oncent-db:${owner}/${repo}:${path}${name}`;
	}

	private async _getAllItemsAndChunks<T extends BaseItem>(
		owner: string,
		repo: string,
		path: string,
		name: string,
		forceRefresh: boolean = false,
	): Promise<{ allItems: T[]; existingChunks: Map<string, string> }> {
		const cacheKey = this.getCacheKey(owner, repo, path, name);

		// 尝试从缓存获取
		if (!forceRefresh && this.cache) {
			const cached = await this.cache.storage.get(cacheKey);
			if (cached) {
				const { data, timestamp } = cached;
				if (Date.now() - timestamp < this.cache.ttl) {
					return {
						allItems: data.allItems,
						existingChunks: new Map(data.existingChunks),
					};
				}
			}
		}

		// 原有的获取逻辑
		const result = await (async () => {
			const allItems: T[] = [];
			const existingChunks = new Map<string, string>();
			const octokit = await this.getOctokit();

			try {
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
						!!file.path &&
						file.type === "blob" &&
						file.path.startsWith(path) &&
						file.path.endsWith(".json") &&
						file.path.split("/").pop()!.startsWith(`${name}-`),
				);

				// Step 5: Fetch content for each found chunk file
				for (const file of chunkFiles) {
					if (file.path && file.sha) {
						existingChunks.set(file.path, file.sha);
						const { data: content } = await octokit.request(
							"GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
							{ owner, repo, file_sha: file.sha },
						);
						const chunkData = JSON.parse(atob(content.content));
						allItems.push(...chunkData);
					}
				}
			} catch (error) {
				// This catch block handles the case where the repo is empty (the ref doesn't exist)
				// or other network issues. For an empty repo, a 404 or 409 is expected.
				if (
					error &&
					typeof error === "object" &&
					"status" in error &&
					(error.status === 404 || error.status === 409)
				) {
					// It's a new/empty repo or the user has no data yet. Silently return empty results.
				} else {
					throw error;
				}
			}
			return { allItems, existingChunks };
		})();

		// 存入缓存
		if (this.cache) {
			await this.cache.storage.set(cacheKey, {
				data: {
					allItems: result.allItems,
					existingChunks: Array.from(result.existingChunks.entries()),
				},
				timestamp: Date.now(),
			});
		}

		return result;
	}

	private async _batch<T extends BaseItem>(
		repoFullName: string,
		operations: BatchOperations<T>,
		config?: CollectionConfig,
	) {
		const octokit = await this.getOctokit();
		const context = await this.getCollectionContext(repoFullName, config);
		const {
			owner,
			repo,
			collectionPath,
			collectionName,
			config: finalConfig,
		} = context;

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

		const { allItems, existingChunks } = await this._getAllItemsAndChunks<T>(
			owner,
			repo,
			collectionPath,
			collectionName,
		);
		const allItemsMap = new Map<string, T>(
			allItems.map((item) => [item.id, item]),
		);

		const treePayload: GitTreeItem[] = [];
		const hasCustomUploader = !!config?.uploader;

		const itemsWithFiles = [
			...(operations.adds || []),
			...(operations.updates?.map((u) => u.changes) || []),
		];
		for (const item of itemsWithFiles) {
			for (const key in item) {
				if (item[key] instanceof File) {
					const file = item[key] as File;
					let fileUrlOrPath: string;
					if (hasCustomUploader) {
						fileUrlOrPath = await finalConfig.uploader!(file);
					} else {
						const fileExtension = file.name.split(".").pop() || "";
						const assetName = `${uuidv4()}${fileExtension ? "." + fileExtension : ""}`;
						const assetPath = `${collectionPath}assets/${assetName}`;
						const base64Content = await blobToBase64(file);
						const { data: blob } = await octokit.request(
							"POST /repos/{owner}/{repo}/git/blobs",
							{ owner, repo, content: base64Content, encoding: "base64" },
						);
						treePayload.push({
							path: assetPath,
							mode: "100644",
							type: "blob",
							sha: blob.sha,
						});
						fileUrlOrPath = `assets/${assetName}`;
					}
					(item as any)[key] = fileUrlOrPath;
				}
			}
		}

		if (operations.removes) {
			for (const id of operations.removes) {
				if (finalConfig.deletionStrategy === "soft" && allItemsMap.has(id)) {
					allItemsMap.get(id)!._deleted_at = new Date().toISOString();
				} else {
					allItemsMap.delete(id);
				}
			}
		}
		if (operations.updates) {
			for (const { id, changes } of operations.updates) {
				if (allItemsMap.has(id)) {
					allItemsMap.set(id, { ...allItemsMap.get(id)!, ...changes });
				}
			}
		}
		if (operations.adds) {
			for (const item of operations.adds) {
				allItemsMap.set((item as T).id, item as T);
			}
		}

		const finalItems = Array.from(allItemsMap.values());
		const newChunksData: string[] = [];
		for (let i = 0; i < finalItems.length; i += finalConfig.itemsPerChunk) {
			newChunksData.push(
				JSON.stringify(
					finalItems.slice(i, i + finalConfig.itemsPerChunk),
					null,
					2,
				),
			);
		}

		newChunksData.forEach((content, index) => {
			const chunkIndex = (index + 1).toString().padStart(3, "0");
			treePayload.push({
				path: `${collectionPath}${collectionName}-${chunkIndex}.json`,
				mode: "100644",
				type: "blob",
				content,
			});
		});

		existingChunks.forEach((_sha, path) => {
			if (!treePayload.some((t) => t.path === path)) {
				treePayload.push({ path, mode: "100644", type: "blob", sha: null });
			}
		});

		if (treePayload.length === 0) return;

		const { data: newTree } = await octokit.request(
			"POST /repos/{owner}/{repo}/git/trees",
			{ owner, repo, tree: treePayload, base_tree: baseTreeSha },
		);
		const { data: newCommit } = await octokit.request(
			"POST /repos/{owner}/{repo}/git/commits",
			{
				owner,
				repo,
				message: `[OncentDB] Batch update for ${collectionName}`,
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
		// 成功提交后更新缓存，而不是简单地删除
		if (this.cache) {
			const context = await this.getCollectionContext(repoFullName, config);
			const cacheKey = this.getCacheKey(
				context.owner,
				context.repo,
				context.collectionPath,
				context.collectionName,
			);

			// 从新的树中提取每个文件的 SHA
			const newChunkShas = new Map(
				newTree.tree
					.filter(
						(item) =>
							item.path?.startsWith(collectionPath) &&
							item.path.endsWith(".json") &&
							item.path.split("/").pop()?.startsWith(`${collectionName}-`),
					)
					.map((item) => [item.path!, item.sha!]),
			);

			const updatedCache = {
				data: {
					allItems: finalItems,
					existingChunks: Array.from(
						newChunksData.map((_, index) => {
							const chunkIndex = (index + 1).toString().padStart(3, "0");
							const path = `${collectionPath}${collectionName}-${chunkIndex}.json`;
							// 使用新树中的实际 SHA
							return [path, newChunkShas.get(path) || ""] as [string, string];
						}),
					),
				},
				timestamp: Date.now(),
			};

			await this.cache.storage.set(cacheKey, updatedCache);
		}
	}

	// ----------------------------------------------------------------
	// PUBLIC API - REPOSITORY LEVEL
	// ----------------------------------------------------------------

	async listRepositories(): Promise<string[]> {
		const octokit = await this.getOctokit();
		const repos = await octokit.paginate("GET /user/repos", { type: "all" });
		return repos
			.filter((repo) => repo.name.startsWith(this.config.repoPrefix))
			.map((repo) => repo.full_name);
	}

	async createRepository(name: string): Promise<void> {
		const octokit = await this.getOctokit();
		const owner = (await this.getUserInfo()).login;
		const repoName = `${this.config.repoPrefix}-${name}`;
		await octokit.request("POST /user/repos", {
			name: repoName,
			private: true,
		});
		// Add an initial file to initialize the default branch
		await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
			owner,
			repo: repoName,
			path: "README.md",
			message: "Initial commit by OncentDB",
			content: btoa("This repository was initialized by OncentDB."), // btoa is for browser environment
		});
	}

	// ----------------------------------------------------------------
	// PUBLIC API - COLLECTION/ITEM LEVEL
	// ----------------------------------------------------------------

	async getAllItems<T extends BaseItem>(
		repoFullName: string,
		config?: CollectionConfig,
	): Promise<OutputType<T>[]> {
		const context = await this.getCollectionContext(repoFullName, config);
		const { allItems } = await this._getAllItemsAndChunks<T>(
			context.owner,
			context.repo,
			context.collectionPath,
			context.collectionName,
		);

		const results =
			context.config.deletionStrategy === "soft"
				? allItems.filter((item) => !item._deleted_at)
				: allItems;

		for (const item of results) {
			for (const key in item) {
				const value = item[key];
				if (typeof value === "string" && value.startsWith("assets/")) {
					(item as any)[key] =
						`https://raw.githubusercontent.com/${context.owner}/${context.repo}/HEAD/${context.collectionPath}${value}`;
				}
			}
		}
		return results as OutputType<T>[];
	}

	async getItemById<T extends BaseItem>(
		repoFullName: string,
		itemId: string,
		config?: CollectionConfig,
	): Promise<OutputType<T> | undefined> {
		const context = await this.getCollectionContext(repoFullName, config);
		const { allItems } = await this._getAllItemsAndChunks<T>(
			context.owner,
			context.repo,
			context.collectionPath,
			context.collectionName,
		);
		const item = allItems.find((item) => item.id === itemId);

		if (
			!item ||
			(context.config.deletionStrategy === "soft" && item._deleted_at)
		) {
			return undefined;
		}

		for (const key in item) {
			const value = item[key];
			if (typeof value === "string" && value.startsWith("assets/")) {
				(item as any)[key] =
					`https://raw.githubusercontent.com/${context.owner}/${context.repo}/HEAD/${context.collectionPath}${value}`;
			}
		}
		return item as OutputType<T>;
	}

	async addItem<T extends BaseItem>(
		repoFullName: string,
		item: InputType<T>,
		config?: CollectionConfig,
	): Promise<void> {
		await this._batch<T>(repoFullName, { adds: [item] }, config);
	}

	async updateItem<T extends BaseItem>(
		repoFullName: string,
		itemId: string,
		changes: Partial<InputType<T>>,
		config?: CollectionConfig,
	): Promise<void> {
		await this._batch<T>(
			repoFullName,
			{ updates: [{ id: itemId, changes }] },
			config,
		);
	}

	async removeItem<T extends BaseItem>(
		repoFullName: string,
		itemId: string,
		config?: CollectionConfig,
	): Promise<void> {
		await this._batch<T>(repoFullName, { removes: [itemId] }, config);
	}

	async batch<T extends BaseItem>(
		repoFullName: string,
		operations: BatchOperations<T>,
		config?: CollectionConfig,
	): Promise<void> {
		await this._batch<T>(repoFullName, operations, config);
	}
}

/**
 * 创建基于 IndexedDB 的缓存存储实现
 * @param dbName 数据库名称
 * @param storeName 存储对象名称
 * @returns CacheStorage 实现
 */
export async function createIndexedDBStorage(
	dbName: string = "oncent-db-cache",
	storeName: string = "cache-store",
): Promise<CacheStorage> {
	// 打开数据库连接
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName);
			}
		};
	});

	// 创建通用的事务处理函数
	const createTransaction = (mode: IDBTransactionMode = "readonly") => {
		const transaction = db.transaction(storeName, mode);
		const store = transaction.objectStore(storeName);
		return { transaction, store };
	};

	return {
		async get(key: string): Promise<any> {
			const { store } = createTransaction("readonly");
			return new Promise((resolve, reject) => {
				const request = store.get(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
		},

		async set(key: string, value: any): Promise<void> {
			const { store } = createTransaction("readwrite");
			return new Promise((resolve, reject) => {
				const request = store.put(value, key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		},

		async remove(key: string): Promise<void> {
			const { store } = createTransaction("readwrite");
			return new Promise((resolve, reject) => {
				const request = store.delete(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		},
	};
}
