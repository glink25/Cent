import { decode, encode } from "js-base64";
import type { Octokit } from "octokit";
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

const loadOctokit = () => import("octokit").then((v) => v.Octokit);

const treeDateToStructure = (
    tree: {
        path: string;
        mode: string;
        type: string;
        sha: string;
        size?: number;
        url?: string;
    }[],
    entryName: string,
) => {
    const structure = tree.reduce(
        (p, c) => {
            if (c.path === "meta.json") {
                p.meta = c;
            } else if (c.path.startsWith("assets/")) {
                p.assets.push(c);
            } else if (
                c.path.startsWith(`${entryName}-`) &&
                c.path.endsWith(`.json`)
            ) {
                const startIndex = Number(
                    c.path.replace(`${entryName}-`, "").replace(".json", ""),
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
    // GitHub API返回的是字典序（entry-1000, entry-10000, entry-2000）
    // 需要按数字排序（entry-1000, entry-2000, entry-10000）
    structure.chunks.sort((a, b) => a.startIndex - b.startIndex);

    // 对assets按路径排序，保持一致性
    structure.assets.sort((a, b) => a.path.localeCompare(b.path));

    return structure;
};

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

/**
 * createGithubSyncer
 * args: { auth: ()=>Promise<{ accessToken, refreshToken? }>, repoPrefix?:string, entryName?:string }
 */
export const createGithubSyncer = (config: {
    auth: any;
    repoPrefix: string;
    entryName: string;
}): Syncer => {
    const {
        auth,
        repoPrefix = "gitray-db",
        entryName = "entry",
    } = config || {};

    const getOctokit = (() => {
        let oc: Octokit | undefined;
        return async () => {
            if (!oc) {
                const Octokit = await loadOctokit();
                const { accessToken } = await auth();
                oc = new Octokit({ auth: accessToken });
            }
            return oc;
        };
    })();

    // fetch repo tree -> structure
    const fetchStructure = async (storeFullName: string) => {
        const octokit = await getOctokit();

        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        const { data: repoData } = await octokit.request(
            "GET /repos/{owner}/{repo}",
            { owner, repo },
        );
        const { data: refData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/ref/{ref}",
            { owner, repo, ref: `heads/${repoData.default_branch}` },
        );
        const latestCommitSha = refData.object.sha;

        const { data: commitData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
            { owner, repo, commit_sha: latestCommitSha },
        );
        const treeSha = commitData.tree.sha;

        const { data: treeData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
            {
                owner,
                repo,
                tree_sha: treeSha,
                recursive: "true",
            },
        );

        const structure = treeDateToStructure(treeData.tree, entryName);
        return structure;
    };

    // fetch blobs by sha and decode content (base64)
    const fetchContent = async (storeFullName: string, files: FileLike[]) => {
        const octokit = await getOctokit();

        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        return Promise.all(
            files.map(async (f) => {
                const { data: content } = await octokit.request(
                    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
                    { owner, repo, file_sha: f.sha },
                );
                return {
                    path: f.path,
                    sha: f.sha,
                    content: JSON.parse(decode(content.content)),
                } as FileWithContent;
            }),
        );
    };

    // upload (array of FileWithContent) -> create blobs + tree + commit + update ref
    const uploadContent = async (
        storeFullName: string,
        files: { path: string; content: any }[],
        signal?: AbortSignal,
    ) => {
        const octokit = await getOctokit();

        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        // create blobs for each file, if content is null -> mark sha null (deletion)
        const treePayload: any[] = await Promise.all(
            files.map(async (f) => {
                if (f.content === null || f.content === undefined) {
                    return {
                        path: f.path,
                        mode: "100644",
                        type: "blob",
                        sha: null,
                    };
                }
                const contentFile = await (async () => {
                    if (f.content instanceof File) {
                        return f.content;
                    }
                    const contentStr =
                        typeof f.content === "string"
                            ? f.content
                            : JSON.stringify(f.content, null, 2);
                    return new File(
                        [new Blob([contentStr])],
                        pathToName(f.path),
                    );
                })();
                const base64Content = await blobToBase64(contentFile);
                const { data: blob } = await octokit.request(
                    "POST /repos/{owner}/{repo}/git/blobs",
                    {
                        owner,
                        repo,
                        content: base64Content,
                        encoding: "base64",
                        request: {
                            signal,
                        },
                    },
                );
                return {
                    path: f.path,
                    mode: "100644",
                    type: "blob",
                    sha: blob.sha,
                };
            }),
        );

        // get base tree
        const { data: repoData } = await octokit.request(
            "GET /repos/{owner}/{repo}",
            {
                owner,
                repo,
                request: {
                    signal,
                },
            },
        );
        const { data: refData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/ref/{ref}",
            {
                owner,
                repo,
                ref: `heads/${repoData.default_branch}`,
                request: {
                    signal,
                },
            },
        );
        const { data: commitData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
            {
                owner,
                repo,
                commit_sha: refData.object.sha,
                request: {
                    signal,
                },
            },
        );
        const baseTreeSha = commitData.tree.sha;
        const latestCommitSha = refData.object.sha;

        const { data: newTree } = await octokit.request(
            "POST /repos/{owner}/{repo}/git/trees",
            {
                owner,
                repo,
                tree: treePayload,
                base_tree: baseTreeSha,
                request: {
                    signal,
                },
            },
        );

        const { data: newCommit } = await octokit.request(
            "POST /repos/{owner}/{repo}/git/commits",
            {
                owner,
                repo,
                message: `[Tidal] update for ${storeFullName}`,
                tree: newTree.sha,
                parents: [latestCommitSha],
                request: {
                    signal,
                },
            },
        );

        await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
            owner,
            repo,
            ref: `heads/${repoData.default_branch}`,
            sha: newCommit.sha,
            request: {
                signal,
            },
        });
        return treeDateToStructure(newTree.tree, config.entryName);
    };

    const transformAsset = (file: File, storeFullName: string) => {
        // produce a raw.githubusercontent.com URL key that points to assets/<name>
        const [owner, repo] = storeFullName.split("/");
        const key = `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/${shortId()}-${file.name}`;
        return key;
    };

    const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
        // If fileKey is raw.githubusercontent url, fetch it
        if (!fileKey.startsWith("https://raw.githubusercontent.com")) {
            throw new Error("Unsupported asset key");
        }
        const [owner, repo, ref, ...paths] = fileKey
            .replace("https://raw.githubusercontent.com/", "")
            .replace("HEAD/", "")
            .split("/");
        const { accessToken } = await auth();
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${paths.join("/")}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github.v3.raw",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            },
        );
        const blob = await res.blob();
        // Convert blob to File so caller can use it
        const name = pathToName(paths.join("/"));
        return blob;
        // const file = new File([blob], name);
        // return file;
    };

    const assetEntryToPath = (a: FileEntry<string>) => {
        const path = a.formattedValue.replace(
            `https://raw.githubusercontent.com/`,
            "",
        );
        // formattedValue includes owner/repo etc; we just need assets/... path
        // try to extract 'assets/...' portion
        const idx = path.indexOf("/main/");
        const assetPath = idx !== -1 ? path.slice(idx + "/main/".length) : path;
        return assetPath;
    };

    // optional createStore implementation (used by createTidal.create)
    const createStore = async (name: string) => {
        const octokit = await getOctokit();

        const { data: me } = await octokit.request("GET /user");
        const owner = me.login;
        const storeName = `${repoPrefix}-${name}`;
        await octokit.request("POST /user/repos", {
            name: storeName,
            private: true,
        });
        await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo: storeName,
            path: "meta.json",
            message: "Initial commit by Tidal",
            content: encode(JSON.stringify({})),
        });
        return { id: `${owner}/${storeName}`, name: storeName };
    };

    const getUserInfo = async (id?: string) => {
        const octokit = await getOctokit();
        const { data } = await octokit.request("GET /user/{account_id}", {
            account_id: id as unknown as number,
        });
        return {
            avatar_url: data.avatar_url,
            name: data.login,
            id: data.id as unknown as string,
        };
    };
    const getCollaborators = async (id: string) => {
        const octokit = await getOctokit();
        const [owner, repo] = id.split("/");
        const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/collaborators",
            { owner, repo },
        );
        return data.map((v) => ({
            avatar_url: v.avatar_url,
            name: v.login,
            id: v.id as unknown as string,
        })) as UserInfo[];
    };

    const fetchAllStore = async () => {
        const octokit = await getOctokit();
        const repos = await octokit.paginate("GET /user/repos", {
            type: "all",
        });
        return repos
            .filter((repo) => repo.name.startsWith(config.repoPrefix))
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
