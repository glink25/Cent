// To use this library, you need to install octokit and uuid:
// npm install octokit uuid
// npm install -D @types/uuid

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
		Omit<OncentDbClientConfig, "collectionName" | "auth">
	>;
	private readonly collectionName: string;
	private authProvider: () => Promise<{
		accessToken: string;
		refreshToken?: string;
	}>;
	private userInfo: { id: number; login: string } | null = null;

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

	private async _getAllItemsAndChunks<T extends BaseItem>(
		owner: string,
		repo: string,
		path: string,
		name: string,
	): Promise<{ allItems: T[]; existingChunks: Map<string, string> }> {
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
