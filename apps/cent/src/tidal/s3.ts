import type { UserInfo } from "@/api/endpoints/type";
import type { FileEntry } from "@/database/assets";
import { shortId } from "@/database/id";
import type { AssetKey, FileLike, StoreStructure, Syncer } from ".";

type S3Config = {
    /** S3服务端点URL（例如：https://s3.amazonaws.com 或自建S3服务地址） */
    endpoint: string;
    /** AWS区域（例如：us-east-1, ap-southeast-1） */
    region: string;
    /** 访问密钥ID */
    accessKeyId: string;
    /** 访问密钥密码 */
    secretAccessKey: string;
    /** S3存储桶名称 */
    bucket: string;
    /** 文件基础目录前缀（可选，默认为"cent"） */
    baseDir?: string;
    /** 仓库名称前缀（可选，默认为"cent-journal"） */
    repoPrefix?: string;
    /** 数据条目名称（可选，默认为"ledger"） */
    entryName?: string;
    /** 是否强制使用路径风格（MinIO等自建S3需要，默认false） */
    forcePathStyle?: boolean;
    /** 会话令牌（可选，用于临时凭证） */
    sessionToken?: string;
};

/**
 * 动态加载AWS SDK
 * 统一管理所有S3相关的导入，避免在多处重复导入
 */
const loadS3SDK = async () => {
    const sdk = await import("@aws-sdk/client-s3");
    return {
        S3Client: sdk.S3Client,
        ListObjectsV2Command: sdk.ListObjectsV2Command,
        GetObjectCommand: sdk.GetObjectCommand,
        PutObjectCommand: sdk.PutObjectCommand,
        DeleteObjectCommand: sdk.DeleteObjectCommand,
        HeadBucketCommand: sdk.HeadBucketCommand,
    };
};

type S3SDK = Awaited<ReturnType<typeof loadS3SDK>>;
type S3ClientType = InstanceType<S3SDK["S3Client"]>;

/**
 * 创建S3客户端实例
 * 类似于web-dav的createClient模式
 */
const createClient = async (config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    forcePathStyle?: boolean;
}) => {
    const { S3Client } = await loadS3SDK();

    const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken && {
                sessionToken: config.sessionToken,
            }),
        },
        forcePathStyle: config.forcePathStyle,
    });

    return client;
};

type S3Object = {
    Key: string;
    ETag: string;
    Size: number;
    LastModified: string;
};

/**
 * 将S3的ETag转换为sha值
 * S3的ETag通常是文件的MD5哈希值（带引号），或者是分片上传的组合哈希
 */
const s3ObjectToSha = (obj: S3Object) => {
    const etag = obj.ETag.replace(/"/g, ""); // 移除引号
    const lastModified = obj.LastModified;
    const size = obj.Size;
    return `${etag}:${lastModified}:${size}`;
};

/**
 * 将S3对象列表解析为StoreStructure
 * @param objects S3对象列表
 * @param entryName 集合名称
 * @param basePath store的基础路径前缀（例如：cent/my-store）
 */
const s3ObjectsToStructure = (
    objects: S3Object[],
    entryName: string,
    basePath: string,
) => {
    const structure: StoreStructure<{
        path: string;
        sha: string;
        etag: string;
        lastModified: string;
        size: number;
    }> = {
        chunks: [],
        assets: [],
        meta: { path: "", sha: "", etag: "", lastModified: "", size: 0 },
    };

    for (const obj of objects) {
        // 获取相对于store根目录的路径
        const relativePath = obj.Key.replace(`${basePath}/`, "");

        if (relativePath === "meta.json") {
            structure.meta = {
                path: relativePath,
                sha: s3ObjectToSha(obj),
                etag: obj.ETag.replace(/"/g, ""),
                lastModified: obj.LastModified,
                size: obj.Size,
            };
        } else if (relativePath.startsWith("assets/")) {
            structure.assets.push({
                path: relativePath,
                sha: s3ObjectToSha(obj),
                etag: obj.ETag.replace(/"/g, ""),
                lastModified: obj.LastModified,
                size: obj.Size,
            });
        } else if (
            relativePath.startsWith(`${entryName}-`) &&
            relativePath.endsWith(`.json`)
        ) {
            const startIndex = Number(
                relativePath.replace(`${entryName}-`, "").replace(".json", ""),
            );
            structure.chunks.push({
                path: relativePath,
                sha: s3ObjectToSha(obj),
                etag: obj.ETag.replace(/"/g, ""),
                lastModified: obj.LastModified,
                size: obj.Size,
                startIndex,
            });
        }
    }

    // 按照startIndex数字顺序对chunks进行排序
    // S3返回的是字典序（ledger-1000, ledger-10000, ledger-2000）
    // 需要按数字排序（ledger-1000, ledger-2000, ledger-10000）
    structure.chunks.sort((a, b) => a.startIndex - b.startIndex);

    // 对assets按路径排序，保持一致性
    structure.assets.sort((a, b) => a.path.localeCompare(b.path));

    return structure;
};

export const createS3Syncer = (cfg: S3Config): Syncer => {
    const config = {
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger",
        forcePathStyle: false,
        ...cfg,
    };

    // 缓存S3客户端实例和SDK命令
    let s3ClientInstance: S3ClientType | undefined;
    let s3SDK: S3SDK | undefined;

    const getClient = async () => {
        if (s3ClientInstance && s3SDK) {
            return { client: s3ClientInstance, commands: s3SDK };
        }

        // 统一加载SDK
        s3SDK = await loadS3SDK();

        // 创建客户端实例
        s3ClientInstance = await createClient({
            endpoint: config.endpoint,
            region: config.region,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken,
            forcePathStyle: config.forcePathStyle,
        });

        return { client: s3ClientInstance, commands: s3SDK };
    };

    const fetchStructure = async (
        storeFullName: string,
        signal?: AbortSignal,
    ) => {
        const { client, commands } = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;

        try {
            const command = new commands.ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: `${storePath}/`,
            });

            const response = await client.send(command, {
                abortSignal: signal,
            });

            if (!response.Contents || response.Contents.length === 0) {
                // 目录不存在或为空，返回空结构
                return {
                    chunks: [],
                    assets: [],
                    meta: { path: "", sha: "", size: 0 },
                } as StoreStructure;
            }

            const objects: S3Object[] = response.Contents.map(
                (obj: {
                    Key?: string;
                    ETag?: string;
                    Size?: number;
                    LastModified?: Date;
                }) => ({
                    Key: obj.Key ?? "",
                    ETag: obj.ETag ?? "",
                    Size: obj.Size ?? 0,
                    LastModified: obj.LastModified?.toISOString() ?? "",
                }),
            );

            return s3ObjectsToStructure(objects, config.entryName, storePath);
        } catch (e) {
            const error = e as {
                name?: string;
                $metadata?: { httpStatusCode?: number };
            };
            if (
                error.name === "NoSuchBucket" ||
                error.$metadata?.httpStatusCode === 404
            ) {
                return {
                    chunks: [],
                    assets: [],
                    meta: { path: "", sha: "", size: 0 },
                } as StoreStructure;
            }
            throw e;
        }
    };

    const fetchContent = async (
        storeFullName: string,
        files: FileLike[],
        signal?: AbortSignal,
    ) => {
        const { client, commands } = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;
        const results = [];

        // 串行获取文件内容（避免过多并发请求）
        for (const file of files) {
            const key = `${storePath}/${file.path}`;
            try {
                const command = new commands.GetObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                });

                const response = await client.send(command, {
                    abortSignal: signal,
                });

                // 将流转换为字符串
                const bodyString = await response.Body?.transformToString();
                const content = JSON.parse(bodyString || "{}");

                const sha = `${response.ETag?.replace(/"/g, "")}:${response.LastModified?.toISOString() ?? ""}:${response.ContentLength ?? 0}`;

                results.push({
                    ...file,
                    sha,
                    content,
                });
            } catch (e) {
                console.error(`Failed to fetch S3 object ${key}:`, e);
                throw e;
            }
        }

        return results;
    };

    const uploadContent = async (
        storeFullName: string,
        files: { path: string; content: any }[],
        signal?: AbortSignal,
    ) => {
        const { client, commands } = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;

        // 串行处理每个文件
        for (const f of files) {
            const key = `${storePath}/${f.path}`;

            if (f.content === null || f.content === undefined) {
                // 删除文件
                try {
                    const command = new commands.DeleteObjectCommand({
                        Bucket: config.bucket,
                        Key: key,
                    });
                    await client.send(command, { abortSignal: signal });
                } catch (e) {
                    // 文件不存在时忽略错误
                    const error = e as { name?: string };
                    if (error.name !== "NoSuchKey") {
                        throw e;
                    }
                }
            } else {
                // 上传文件
                let body: string | Uint8Array;
                let contentType: string;

                if (
                    typeof (f.content as { arrayBuffer?: unknown })
                        .arrayBuffer === "function"
                ) {
                    // 二进制文件 (Blob/File)
                    const arrayBuffer = await (f.content as Blob).arrayBuffer();
                    body = new Uint8Array(arrayBuffer);
                    contentType =
                        (f.content as Blob).type || "application/octet-stream";
                } else {
                    // JSON 文件
                    const contentStr =
                        typeof f.content === "string"
                            ? f.content
                            : JSON.stringify(f.content, null, 2);
                    body = contentStr;
                    contentType = "application/json";
                }

                const command = new commands.PutObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                    Body: body,
                    ContentType: contentType,
                });

                await client.send(command, { abortSignal: signal });
            }
        }

        // 重新获取结构（获取新的ETag）
        return await fetchStructure(storeFullName, signal);
    };

    const transformAsset = (file: File, storeFullName: string) => {
        const assetPath = `assets/${shortId()}-${file.name}`;
        // 返回S3对象的完整路径作为AssetKey
        return `s3://${config.bucket}/${config.baseDir}/${storeFullName}/${assetPath}`;
    };

    const assetEntryToPath = (a: FileEntry<string>, storePath: string) => {
        // 从S3 URI中提取相对路径
        // 格式: s3://bucket/baseDir/storeName/assets/xxx.jpg
        const uri = a.formattedValue;
        const prefix = `s3://${config.bucket}/${config.baseDir}/${storePath}/`;
        return uri.replace(prefix, "");
    };

    const getAsset = async (fileKey: AssetKey, _storeFullName: string) => {
        try {
            const { client, commands } = await getClient();

            // 从S3 URI解析出Key
            // 格式: s3://bucket/path/to/file
            const uri = fileKey.replace("s3://", "");
            const [bucket, ...pathParts] = uri.split("/");
            const key = pathParts.join("/");

            const command = new commands.GetObjectCommand({
                Bucket: bucket,
                Key: key,
            });

            const response = await client.send(command);

            // 将流转换为Blob
            const arrayBuffer = await response.Body?.transformToByteArray();
            if (!arrayBuffer) {
                throw new Error("Failed to read asset data");
            }
            const blob = new Blob([arrayBuffer as unknown as ArrayBuffer], {
                type: response.ContentType,
            });

            return blob;
        } catch (e) {
            console.error(`getAsset failed for key ${fileKey}:`, e);
            throw e;
        }
    };

    const createStore = async (name: string) => {
        const { client, commands } = await getClient();
        const storeName = `${config.repoPrefix}-${name}`;
        const storePath = `${config.baseDir}/${storeName}`;

        // 创建meta.json（S3没有真正的目录，通过创建文件来模拟）
        const metaCommand = new commands.PutObjectCommand({
            Bucket: config.bucket,
            Key: `${storePath}/meta.json`,
            Body: JSON.stringify({}),
            ContentType: "application/json",
        });
        await client.send(metaCommand);

        // 创建assets目录标记（可选，某些S3实现需要）
        const assetsMarkerCommand = new commands.PutObjectCommand({
            Bucket: config.bucket,
            Key: `${storePath}/assets/.keep`,
            Body: "",
            ContentType: "text/plain",
        });
        await client.send(assetsMarkerCommand);

        return { id: storeName, name: storeName };
    };

    const getUserInfo = async (_id?: string) => {
        // S3没有标准的用户API，返回基于配置的简单信息
        return {
            avatar_url: undefined,
            name: config.accessKeyId,
            id: config.accessKeyId,
        } as unknown as UserInfo;
    };

    const getCollaborators = async (_id: string) => {
        // S3没有标准的协作者概念
        return [] as UserInfo[];
    };

    const fetchAllStore = async () => {
        const { client, commands } = await getClient();

        try {
            const command = new commands.ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: `${config.baseDir}/`,
                Delimiter: "/",
            });

            const response = await client.send(command);

            if (!response.CommonPrefixes) {
                return [];
            }

            // 从CommonPrefixes中提取store名称
            return response.CommonPrefixes.map(
                (prefix: { Prefix?: string }) => {
                    const path = prefix.Prefix ?? "";
                    const storeName = path
                        .replace(`${config.baseDir}/`, "")
                        .replace(/\/$/, "");
                    return storeName;
                },
            ).filter((name: string) =>
                name.startsWith(config.repoPrefix ?? ""),
            );
        } catch (e) {
            const error = e as {
                name?: string;
                $metadata?: { httpStatusCode?: number };
            };
            if (
                error.name === "NoSuchBucket" ||
                error.$metadata?.httpStatusCode === 404
            ) {
                return [];
            }
            throw e;
        }
    };

    return {
        fetchAllStore,
        fetchStructure,
        fetchContent,
        uploadContent,
        transformAsset,
        getAsset,
        createStore,
        getUserInfo,
        getCollaborators,
        assetEntryToPath,
    };
};

/**
 * 检查S3配置是否有效
 */
export const checkS3Config = async (
    config: Pick<
        S3Config,
        | "endpoint"
        | "region"
        | "accessKeyId"
        | "secretAccessKey"
        | "bucket"
        | "forcePathStyle"
        | "sessionToken"
    >,
) => {
    try {
        // 使用统一的SDK加载和客户端创建方式
        const sdk = await loadS3SDK();
        const client = await createClient({
            endpoint: config.endpoint,
            region: config.region,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken,
            forcePathStyle: config.forcePathStyle,
        });

        // 尝试访问bucket
        const command = new sdk.HeadBucketCommand({
            Bucket: config.bucket,
        });

        await client.send(command);
        return true;
    } catch (e) {
        const error = e as {
            name?: string;
            $metadata?: { httpStatusCode?: number };
            message?: string;
        };
        let errorMessage = "Unknown S3 connection error.";

        if (
            error.name === "NotFound" ||
            error.$metadata?.httpStatusCode === 404
        ) {
            errorMessage = `Bucket '${config.bucket}' not found. Please check the bucket name.`;
        } else if (
            error.name === "Forbidden" ||
            error.$metadata?.httpStatusCode === 403
        ) {
            errorMessage =
                "Access denied (403 Forbidden). Please check your credentials and permissions.";
        } else if (
            error.name === "InvalidAccessKeyId" ||
            error.$metadata?.httpStatusCode === 401
        ) {
            errorMessage =
                "Authentication failed. Please check your accessKeyId and secretAccessKey.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        throw new Error(errorMessage);
    }
};
