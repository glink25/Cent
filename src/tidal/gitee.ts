import { decode, encode } from "js-base64";
import type { UserInfo } from "@/api/endpoints/type";
import type { FileEntry } from "@/database/assets";
import { shortId } from "@/database/id";
import type {
    AssetKey,
    FileLike,
    FileWithContent,
    StoreStructure,
    Syncer,
} from ".";

/**
 * createGiteeSyncer
 * config: { auth: ()=>Promise<{accessToken, refreshToken?}>, repoPrefix?: string, entryName?: string }
 */
export const createGiteeSyncer = (config: {
    auth: () => Promise<{ accessToken: string; refreshToken?: string }>;
    repoPrefix?: string;
    entryName?: string;
}): Syncer => {
    const {
        auth,
        repoPrefix = "gitray-db",
        entryName = "entry",
    } = config || {};

    const GITEE_API_BASE = "https://gitee.com/api/v5";

    const pathToName = (path: string) => {
        const splitted = path.split("/");
        return splitted[splitted.length - 1];
    };

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

    const treeDateToStructure = (
        tree: {
            path: string;
            mode: string;
            type: string;
            sha: string;
            size?: number;
            url?: string;
        }[],
        entryNameLocal: string,
    ) => {
        const structure = tree.reduce(
            (p, c) => {
                if (c.path === "meta.json") {
                    p.meta = c;
                } else if (c.path.startsWith("assets/")) {
                    p.assets.push(c);
                } else if (
                    c.path.startsWith(`${entryNameLocal}-`) &&
                    c.path.endsWith(`.json`)
                ) {
                    const startIndex = Number(
                        c.path
                            .replace(`${entryNameLocal}-`, "")
                            .replace(".json", ""),
                    );
                    p.chunks.push({ ...c, startIndex });
                }
                return p;
            },
            {
                chunks: [],
                assets: [],
                meta: { path: "", sha: "", size: 0 },
            } as StoreStructure,
        );

        // 按照startIndex数字顺序对chunks进行排序
        // Gitee API返回的是字典序（entry-1000, entry-10000, entry-2000）
        // 需要按数字排序（entry-1000, entry-2000, entry-10000）
        structure.chunks.sort((a, b) => a.startIndex - b.startIndex);

        // 对assets按路径排序，保持一致性
        structure.assets.sort((a, b) => a.path.localeCompare(b.path));

        return structure;
    };

    // generic helper to call gitee API with token
    const giteeRequest = async <T = any>(
        method: string,
        path: string,
        body?: any,
        signal?: AbortSignal,
    ): Promise<T> => {
        const { accessToken } = await auth();
        const url = `${GITEE_API_BASE}${path}`;
        const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: `token ${accessToken}`,
        };
        const opts: RequestInit = {
            method,
            headers,
            signal,
        };
        if (body !== undefined) {
            opts.body = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        }
        const res = await fetch(url, opts);
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(
                `Gitee API ${method} ${path} failed: ${res.status} ${res.statusText} - ${txt}`,
            );
        }
        const txt = await res.text();
        return txt ? JSON.parse(txt) : ({} as any);
    };

    // fetch repo tree/structure
    const fetchStructure = async (
        storeFullName: string,
        signal?: AbortSignal,
    ) => {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);
        // 1. repo info to get default branch
        const repoData = await giteeRequest<any>(
            "GET",
            `/repos/${owner}/${repo}`,
            undefined,
            signal,
        );
        const branch = repoData?.default_branch ?? "master";

        // 2. list root contents
        const rootList = await giteeRequest<any[]>(
            "GET",
            `/repos/${owner}/${repo}/contents?ref=${branch}`,
            undefined,
            signal,
        );

        // 3. list assets dir if exists
        let assetsList: any[] = [];
        try {
            assetsList = await giteeRequest<any[]>(
                "GET",
                `/repos/${owner}/${repo}/contents/assets?ref=${branch}`,
                undefined,
                signal,
            );
        } catch {
            assetsList = [];
        }

        // combine
        const combined = [
            ...(Array.isArray(rootList) ? rootList : []),
            ...(Array.isArray(assetsList) ? assetsList : []),
        ].map((f: any) => ({
            path: f.path,
            mode: "100644",
            type: f.type,
            sha: f.sha,
            size: f.size,
            url: f.url,
        }));

        return treeDateToStructure(combined, entryName);
    };

    // fetch content by file list (uses contents API to read file content base64)
    const fetchContent = async (
        storeFullName: string,
        files: FileLike[],
        signal?: AbortSignal,
    ) => {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        const { accessToken } = await auth();

        const promises = files.map(async (f) => {
            const res = await fetch(
                `${GITEE_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`,
                {
                    headers: { Authorization: `token ${accessToken}` },
                    signal,
                },
            );
            if (!res.ok) {
                // file missing or error -> return undefined content but keep sha/path
                return {
                    path: f.path,
                    sha: f.sha,
                    content: undefined,
                } as FileWithContent;
            }
            const data = await res.json();
            const content = JSON.parse(decode(data.content));
            return { path: f.path, sha: f.sha, content } as FileWithContent;
        });

        return Promise.all(promises);
    };

    // upload files: uses contents API per-file (create PUT/POST or DELETE)
    // files: { path, content } where content === null -> delete
    const uploadContent = async (
        storeFullName: string,
        files: { path: string; content: any }[],
        signal?: AbortSignal,
    ) => {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        const { accessToken } = await auth();

        // get default branch
        const repoData = await giteeRequest<any>(
            "GET",
            `/repos/${owner}/${repo}`,
        );
        const branch = repoData?.default_branch ?? "master";

        // helper to get remote sha if exists
        const getRemoteSha = async (path: string) => {
            const res = await fetch(
                `${GITEE_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
                {
                    headers: { Authorization: `token ${accessToken}` },
                    signal,
                },
            );
            if (!res.ok) return null;
            const d = await res.json();
            return d.sha as string | null;
        };

        // sequentially perform ops (create/update/delete)
        for (const f of files) {
            const remoteSha = await getRemoteSha(f.path);
            if (f.content === null || f.content === undefined) {
                // delete if exists
                if (remoteSha) {
                    await giteeRequest(
                        "DELETE",
                        `/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`,
                        {
                            message: `[Tidal] Delete ${f.path}`,
                            sha: remoteSha,
                            branch,
                        },
                        signal,
                    );
                }
                continue;
            }

            // prepare content as base64 string (Gitee expects base64 content in "content" field)
            let base64Content: string;
            if (f.content instanceof File || f.content instanceof Blob) {
                base64Content = await blobToBase64(f.content as Blob);
            } else {
                const contentStr =
                    typeof f.content === "string"
                        ? f.content
                        : JSON.stringify(f.content, null, 2);
                // convert string to blob then to base64
                const file = new File(
                    [new Blob([contentStr])],
                    pathToName(f.path),
                );
                base64Content = await blobToBase64(file);
            }

            const body = {
                message: `[Tidal] Update ${storeFullName}`,
                content: base64Content,
                branch,
                signal,
            };

            if (!remoteSha) {
                await giteeRequest(
                    "POST",
                    `/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`,
                    body,
                    signal,
                );
            } else {
                await giteeRequest(
                    "PUT",
                    `/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`,
                    { ...body, sha: remoteSha },
                    signal,
                );
            }
        }

        // after changes, return fresh structure
        return await fetchStructure(storeFullName);
    };

    // transformAsset: produce a gitee raw url for asset stored under assets/
    const transformAsset = (file: File, storeFullName: string) => {
        const [owner, repo] = storeFullName.split("/");
        // use master by default for simple static raw url
        const key = `https://gitee.com/${owner}/${repo}/master/assets/${shortId()}-${file.name}`;
        return key;
    };

    // getAsset: given a raw gitee url from transformAsset, fetch and return blob
    const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
        if (!fileKey.startsWith("https://gitee.com")) {
            throw new Error("Unsupported asset key");
        }
        // raw url format: https://gitee.com/{owner}/{repo}/raw/{branch}/{path...}
        const splitted = fileKey.split("/");
        const owner = splitted[3];
        const repo = splitted[4];
        const path = splitted.slice(6).join("/"); // after /raw/{branch}/...
        const { accessToken } = await auth();
        const res = await fetch(
            `${GITEE_API_BASE}/repos/${owner}/${repo}/raw/${path}`,
            {
                headers: { Authorization: `token ${accessToken}` },
            },
        );
        if (!res.ok) throw new Error("Failed to fetch asset");
        const blob = await res.blob();
        return blob;
    };

    const assetEntryToPath = (v: FileEntry<string>) => {
        return v.formattedValue.split(`master/`)[1];
    };

    // createStore: create gitee repo and add meta.json
    const createStore = async (name: string) => {
        // get current user
        const me = await giteeRequest<any>("GET", `/user`);
        const owner = me.login;
        const storeName = `${repoPrefix}-${name}`;

        // create repo
        await giteeRequest("POST", `/user/repos`, {
            name: storeName,
            description: `Created by Giteeray`,
            private: true,
        });

        // create meta.json
        const { accessToken } = await auth();
        const path = `/repos/${owner}/${storeName}/contents/meta.json`;
        await fetch(`${GITEE_API_BASE}${path}`, {
            method: "POST",
            headers: {
                Authorization: `token ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: "Initial commit by Giteeray",
                content: encode(JSON.stringify({})),
                branch: "master",
            }),
        });

        return { id: `${owner}/${storeName}`, name: storeName };
    };

    const getUserInfo = async (id?: string) => {
        const { accessToken } = await auth();
        const path = id ? `/users/${id}` : "/user";
        const res = await fetch(`${GITEE_API_BASE}${path}`, {
            headers: { Authorization: `token ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to fetch user info from gitee");
        const data = await res.json();
        return {
            avatar_url: data.avatar_url,
            name: data.login,
            id: data.id as unknown as string,
        } as UserInfo;
    };

    const getCollaborators = async (id: string) => {
        const { accessToken } = await auth();
        const [owner, repo] = id.split("/");
        const res = await fetch(
            `${GITEE_API_BASE}/repos/${owner}/${repo}/collaborators`,
            { headers: { Authorization: `token ${accessToken}` } },
        );
        if (!res.ok) throw new Error("Failed to fetch collaborators");
        const data = await res.json();
        return data.map((v: any) => ({
            avatar_url: v.avatar_url,
            name: v.login,
            id: v.id as unknown as string,
        })) as UserInfo[];
    };

    const fetchAllStore = async () => {
        const repos = await giteeRequest<any[]>("GET", `/user/repos`);
        return (repos || [])
            .filter((repo) => repo.name.startsWith(repoPrefix))
            .map((repo) => repo.full_name);
    };

    return {
        fetchAllStore,
        fetchStructure,
        fetchContent,
        uploadContent,

        transformAsset,
        getAsset,
        assetEntryToPath,

        createStore,
        getUserInfo,
        getCollaborators,
    };
};
