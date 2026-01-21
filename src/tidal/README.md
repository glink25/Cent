# Tidal 实现原理文档

## 概述

Tidal 是一个通用的文件增量同步机制，用于在多个设备中无冲突地同步数组结构的数据以及配置数据（meta.json）。它提供了一个平台无关的同步抽象层，支持 GitHub、Gitee、WebDAV 等多种后端存储。

### 核心特性

- **平台无关**：通过 Syncer 接口抽象不同平台的实现细节
- **增量同步**：只同步变动的部分，避免全量数据传输
- **数据分片**：自动将大数组切分，避免单次请求过长
- **文件资产处理**：自动将 File 对象转换为 AssetKey 字符串
- **无冲突同步**：通过操作日志（Stash）实现数据同步
- **解耦存储**：支持任何实现了 StashStorage 接口的数据库

## 架构设计

### 数据库结构

Tidal 内部维护三张表：

1. **Items 表**：存放主数据（如账单列表）
2. **Stash 表**：存放操作日志（增删改操作）
3. **Config 表**：存放配置信息（包括远程文件结构缓存）

### 核心工作流程

```
用户操作 → batch() → 写入Stash + 更新Items → 触发同步
                                              ↓
                                    syncImmediate() 读取Stash
                                              ↓
                                    上传到远程平台 → 清空Stash
```

## 核心数据结构

### StoreStructure

远程存储的文件结构定义：

```typescript
type StoreStructure<F = FileLike> = {
    chunks: (F & { startIndex: number })[];  // 数据分片文件列表
    meta: F;                                  // 元数据文件
    assets: F[];                              // 资产文件列表
};
```

### FileLike & FileWithContent

```typescript
type FileLike = { 
    path: string;   // 文件路径
    sha: string;    // 文件哈希值（用于判断是否变动）
};

type FileWithContent = FileLike & { 
    content: any;   // 文件实际内容
};
```

### Syncer 接口

所有平台适配器必须实现的接口：

```typescript
type Syncer = {
    // 获取远程仓库的文件结构（不包含内容）
    fetchStructure: (storeFullName: string, signal?: AbortSignal) 
        => Promise<StoreStructure>;
    
    // 批量获取文件内容
    fetchContent: (storeFullName: string, paths: FileLike[], signal?: AbortSignal) 
        => Promise<FileWithContent[]>;
    
    // 上传文件到远程
    uploadContent: (storeFullName: string, files: { path: string; content: string | undefined }[], signal?: AbortSignal) 
        => Promise<StoreStructure>;
    
    // 将 File 对象转换为 AssetKey
    transformAsset: (file: File, storeFullName: string) => AssetKey;
    
    // 创建新的存储仓库
    createStore: (name: string) => Promise<{ id: string; name: string }>;
    
    // 获取资产文件的二进制数据
    getAsset: (fileKey: AssetKey, storeFullName: string) => Promise<Blob>;
    
    // 将资产条目转换为路径
    assetEntryToPath: (entry: FileEntry<string>, storeFullName: string) => string;
    
    // 获取用户信息
    getUserInfo: (id?: string) => Promise<UserInfo>;
    
    // 获取协作者列表
    getCollaborators: (id: string) => Promise<UserInfo[]>;
    
    // 获取所有存储仓库
    fetchAllStore: () => Promise<string[]>;
};
```

## 核心实现原理

### 1. 初始化流程 (init)

```typescript
const init = async (storeFullName: string) => {
    // 1. 获取远程结构和内容
    const { detail, remote, patch } = await fetchStoreDetail(storeFullName);
    
    // 2. 合并远程数据到本地
    const remoteItems = detail.chunks.flatMap((v) => v.content);
    if (patch) {
        await itemBucket.patch(remoteItems, detail.meta?.content);  // 增量更新
    } else {
        await itemBucket.init(remoteItems, detail.meta?.content);   // 全量初始化
    }
    
    // 3. 缓存远程结构到本地配置
    await itemBucket.configStorage.setValue({ structure: remote });
};
```

**关键点**：
- 通过 `diffStructure` 比对本地和远程的哈希值，只下载变动的分片
- 第一次初始化使用 `init`，后续使用 `patch` 增量更新

### 2. 数据变更流程 (batch)

```typescript
const batch = async (storeFullName: string, actions: Action<Item>[], overlap = false) => {
    const { itemBucket } = getStore(storeFullName);
    
    // 1. 将操作写入Stash，同时应用到Items
    await itemBucket.batch(actions, overlap);
    
    // 2. 通知监听器数据已变化
    notifyChange(storeFullName);
    
    // 3. 用户需手动调用 sync() 触发同步
};
```

**Action 类型**：
- `add`: 添加新项
- `update`: 更新已有项
- `delete`: 删除项
- `meta`: 更新元数据

### 3. 同步流程 (syncImmediate)

这是 Tidal 最核心的逻辑：

```typescript
const syncImmediate = async (signal?: AbortSignal) => {
    // 遍历所有 store
    await Promise.all(
        Array.from(storeMap.entries()).map(async ([storeFullName, { itemBucket }]) => {
            // 1. 读取所有待同步的操作
            const stashes = await itemBucket.stashStorage.toArray();
            if (stashes.length === 0) return;
            
            // 2. 分离元数据操作和数据项操作
            const metaStashes = stashes.filter((v) => v.type === "meta");
            const itemStashes = stashes.filter((v) => v.type !== "meta");
            
            // 3. 处理元数据同步
            const metaFiles = await runMetaStashesHandler();
            
            // 4. 处理数据项同步（重点）
            const itemResult = await runItemStashesHandler();
            
            // 5. 上传所有变更
            const newStructure = await syncer.uploadContent(
                storeFullName,
                [...itemResult.chunks, ...metaFiles, ...assetFiles]
            );
            
            // 6. 清空Stash，更新本地结构缓存
            await itemBucket.deleteStashes(...stashes.map(s => s.id));
            await itemBucket.configStorage.setValue({ structure: newStructure });
        })
    );
};
```

#### 数据项同步详解 (runItemStashesHandler)

```typescript
const runItemStashesHandler = async () => {
    // 1. 获取远程结构
    const remoteStructure = await getRemoteStructure();
    
    // 2. 获取最新分片的内容
    const sortedChunk = sortBy(remoteStructure.chunks, (v) => v.startIndex);
    const latestChunk = sortedChunk[sortedChunk.length - 1];
    const latestChunkContent = await fetchContent(storeFullName, [latestChunk]);
    
    // 3. 处理文件资产：File → AssetKey
    const [transformed, assets] = transformAssets(
        itemStashes,
        (file: File) => syncer.transformAsset(file, storeFullName)
    );
    
    // 4. 合并最新分片内容和新增操作
    const newContent = [
        ...(latestChunkContent?.content ?? []),
        ...transformed
    ];
    
    // 5. 按 itemsPerChunk 切分数据
    const chunks = [];
    for (let i = 0; i < newContent.length; i += itemsPerChunk) {
        const con = newContent.slice(i, i + itemsPerChunk);
        const path = `${entryName}-${i + startIndex}.json`;
        chunks.push({ path, content: con });
    }
    
    // 6. overlap模式：标记需要删除的远程文件
    if (isOverlap) {
        remoteStructure.chunks.forEach((rc) => {
            if (!chunks.find(c => c.path === rc.path)) {
                chunks.push({ path: rc.path, content: null });  // null表示删除
            }
        });
    }
    
    return { chunks, assets };
};
```

**关键优化**：
- 只获取最新分片内容，不下载全部数据
- 新操作追加到最新分片，当分片满时自动创建新分片
- overlap模式支持完全覆盖远程数据

### 4. 增量更新机制 (diffStructure)

```typescript
const diffStructure = (remote: StoreStructure, local?: StoreStructure) => {
    if (!local) {
        return { diff: remote, patch: false };  // 首次初始化，下载全部
    }
    
    const diff: DiffedStructure = {
        meta: remote.meta.sha !== local.meta.sha ? remote.meta : undefined,
        chunks: [],
    };
    
    // 找到第一个哈希值不同的分片索引
    const diffChunkIndex = remote.chunks.findIndex((c, i) => {
        return c.sha !== local.chunks[i]?.sha;
    });
    
    if (diffChunkIndex !== -1) {
        diff.chunks = remote.chunks.slice(diffChunkIndex);  // 只下载变动的分片
    }
    
    return { diff, patch: diffChunkIndex !== 0 };
};
```

**核心思想**：
- 通过比对文件哈希值（sha）判断是否需要下载
- 只下载从第一个变动分片开始的所有分片
- 返回 patch=true 表示增量更新，false 表示全量初始化

## GitHub Syncer 实现

### 核心机制

GitHub Syncer 使用 GitHub Git API 进行数据同步，利用 Git 的 blob、tree、commit 机制。

### 1. fetchStructure - 获取文件结构

```typescript
const fetchStructure = async (storeFullName: string) => {
    const [owner, repo] = storeFullName.split("/");
    
    // 1. 获取仓库信息
    const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}");
    
    // 2. 获取默认分支的最新 commit
    const { data: refData } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/ref/{ref}",
        { ref: `heads/${repoData.default_branch}` }
    );
    
    // 3. 获取 commit 的 tree
    const { data: commitData } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
        { commit_sha: refData.object.sha }
    );
    
    // 4. 递归获取完整的文件树
    const { data: treeData } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
        { tree_sha: commitData.tree.sha, recursive: "true" }
    );
    
    // 5. 将 Git tree 转换为 StoreStructure
    return treeDateToStructure(treeData.tree, entryName);
};
```

**关键点**：
- 使用 Git API 获取完整的文件树结构
- 每个文件的 sha 值由 Git 自动计算（基于内容）
- 不下载文件内容，只获取元数据

### 2. fetchContent - 获取文件内容

```typescript
const fetchContent = async (storeFullName: string, files: FileLike[]) => {
    const [owner, repo] = storeFullName.split("/");
    
    return Promise.all(
        files.map(async (f) => {
            // 通过 blob API 获取文件内容
            const { data: content } = await octokit.request(
                "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
                { file_sha: f.sha }
            );
            
            // 解码 base64 内容
            return {
                path: f.path,
                sha: f.sha,
                content: JSON.parse(decode(content.content)),
            };
        })
    );
};
```

**特点**：
- 使用 blob API 直接通过 sha 获取内容
- 内容是 base64 编码的，需要解码
- 并行获取多个文件

### 3. uploadContent - 上传内容

这是最复杂的操作，需要创建 blob → tree → commit → 更新引用：

```typescript
const uploadContent = async (storeFullName: string, files: { path: string; content: any }[]) => {
    const [owner, repo] = storeFullName.split("/");
    
    // 步骤1: 为每个文件创建 blob
    const treePayload = await Promise.all(
        files.map(async (f) => {
            if (f.content === null) {
                // 标记为删除
                return { path: f.path, mode: "100644", type: "blob", sha: null };
            }
            
            // 将内容转换为 base64
            const base64Content = await blobToBase64(contentFile);
            
            // 创建 blob
            const { data: blob } = await octokit.request(
                "POST /repos/{owner}/{repo}/git/blobs",
                { content: base64Content, encoding: "base64" }
            );
            
            return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
        })
    );
    
    // 步骤2: 获取基础 tree（当前最新 commit 的 tree）
    const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}");
    const { data: refData } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/ref/{ref}",
        { ref: `heads/${repoData.default_branch}` }
    );
    const baseTreeSha = refData.object.tree.sha;
    
    // 步骤3: 创建新 tree（基于旧 tree + 新文件）
    const { data: newTree } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/trees",
        { tree: treePayload, base_tree: baseTreeSha }
    );
    
    // 步骤4: 创建新 commit
    const { data: newCommit } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/commits",
        { 
            message: `[Tidal] update for ${storeFullName}`,
            tree: newTree.sha,
            parents: [refData.object.sha]
        }
    );
    
    // 步骤5: 更新分支引用
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        ref: `heads/${repoData.default_branch}`,
        sha: newCommit.sha
    });
    
    // 返回新的文件结构
    return treeDateToStructure(newTree.tree, entryName);
};
```

**Git 工作流**：
```
创建 blobs → 基于旧 tree 创建新 tree → 创建 commit → 更新 ref
```

### 4. transformAsset - 资产处理

```typescript
const transformAsset = (file: File, storeFullName: string) => {
    const [owner, repo] = storeFullName.split("/");
    // 生成 raw.githubusercontent.com URL
    const key = `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/${shortId()}-${file.name}`;
    return key;
};
```

**策略**：
- File 对象转换为 GitHub Raw URL
- 实际文件上传时会保存到 `assets/` 目录
- 通过 raw.githubusercontent.com 可直接访问

### 5. getAsset - 获取资产

```typescript
const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
    const [owner, repo, ref, ...paths] = fileKey
        .replace("https://raw.githubusercontent.com/", "")
        .split("/");
    
    const { accessToken } = await auth();
    const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${paths.join("/")}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.v3.raw",  // 获取原始内容
            }
        }
    );
    
    return await res.blob();
};
```

**特点**：
- 从 AssetKey URL 解析出文件路径
- 使用 GitHub Contents API 获取原始文件
- 返回 Blob 对象供应用使用

## S3 Syncer 实现

### 核心机制

S3 Syncer 使用通用的 S3 协议进行文件同步，兼容 AWS S3、MinIO、阿里云OSS、腾讯云COS等所有支持S3协议的对象存储服务。

### 配置参数

```typescript
type S3Config = {
    endpoint: string;          // S3服务端点URL
    region: string;            // AWS区域（如：us-east-1）
    accessKeyId: string;       // 访问密钥ID
    secretAccessKey: string;   // 访问密钥密码
    bucket: string;            // S3存储桶名称
    baseDir?: string;          // 文件基础目录（默认：cent）
    repoPrefix?: string;       // 仓库名称前缀（默认：cent-journal）
    entryName?: string;        // 数据条目名称（默认：ledger）
    forcePathStyle?: boolean;  // 是否强制路径风格（MinIO需要）
    sessionToken?: string;     // 会话令牌（临时凭证）
};
```

### 1. fetchStructure - 获取文件结构

```typescript
const fetchStructure = async (storeFullName: string, signal?: AbortSignal) => {
    const client = await getS3Client();
    const storePath = `${config.baseDir}/${storeFullName}`;
    
    // 使用ListObjectsV2列出所有对象
    const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: `${storePath}/`,
    });
    
    const response = await client.send(command, { abortSignal: signal });
    const objects = response.Contents.map(obj => ({
        Key: obj.Key,
        ETag: obj.ETag,
        Size: obj.Size,
        LastModified: obj.LastModified.toISOString(),
    }));
    
    // 转换为StoreStructure
    return s3ObjectsToStructure(objects, config.entryName, storePath);
};
```

**关键点**：
- 使用 `ListObjectsV2Command` 列出bucket中的所有对象
- S3的sha由 `ETag:LastModified:Size` 组合生成
- ETag通常是文件的MD5哈希值
- 404错误表示bucket或路径不存在

### 2. s3ObjectsToStructure - 结构转换

```typescript
const s3ObjectsToStructure = (objects: S3Object[], entryName: string, basePath: string) => {
    const structure: StoreStructure = {
        chunks: [],
        assets: [],
        meta: { path: "", sha: "", etag: "", lastModified: "", size: 0 },
    };
    
    for (const obj of objects) {
        const relativePath = obj.Key.replace(`${basePath}/`, "");
        
        if (relativePath === "meta.json") {
            structure.meta = {
                path: relativePath,
                sha: `${obj.ETag}:${obj.LastModified}:${obj.Size}`,
                etag: obj.ETag.replace(/"/g, ""),
                lastModified: obj.LastModified,
                size: obj.Size,
            };
        } else if (relativePath.startsWith("assets/")) {
            structure.assets.push({ /* ... */ });
        } else if (relativePath.startsWith(`${entryName}-`) && relativePath.endsWith(`.json`)) {
            const startIndex = Number(
                relativePath.replace(`${entryName}-`, "").replace(".json", "")
            );
            structure.chunks.push({ path: relativePath, sha: s3ObjectToSha(obj), startIndex });
        }
    }
    
    return structure;
};
```

**S3的sha计算**：
```typescript
const s3ObjectToSha = (obj: S3Object) => {
    const etag = obj.ETag.replace(/"/g, "");  // 移除引号
    const lastModified = obj.LastModified;
    const size = obj.Size;
    return `${etag}:${lastModified}:${size}`;
};
```

### 3. fetchContent - 获取文件内容

```typescript
const fetchContent = async (storeFullName: string, files: FileLike[], signal?: AbortSignal) => {
    const client = await getS3Client();
    const storePath = `${config.baseDir}/${storeFullName}`;
    const results = [];
    
    // 串行获取文件内容
    for (const file of files) {
        const key = `${storePath}/${file.path}`;
        
        const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
        });
        
        const response = await client.send(command, { abortSignal: signal });
        
        // 将流转换为字符串
        const bodyString = await response.Body?.transformToString();
        const content = JSON.parse(bodyString || "{}");
        
        results.push({
            ...file,
            sha: `${response.ETag}:${response.LastModified}:${response.ContentLength}`,
            content,
        });
    }
    
    return results;
};
```

**特点**：
- 使用 `GetObjectCommand` 获取对象内容
- S3返回的是流，需要转换为字符串
- 串行获取避免并发限制

### 4. uploadContent - 上传内容

```typescript
const uploadContent = async (storeFullName: string, files: { path: string; content: any }[], signal?: AbortSignal) => {
    const client = await getS3Client();
    const storePath = `${config.baseDir}/${storeFullName}`;
    
    // 串行处理每个文件
    for (const f of files) {
        const key = `${storePath}/${f.path}`;
        
        if (f.content === null || f.content === undefined) {
            // 删除文件
            const command = new DeleteObjectCommand({
                Bucket: config.bucket,
                Key: key,
            });
            await client.send(command, { abortSignal: signal });
        } else {
            // 上传文件
            let body: any;
            let contentType: string;
            
            if (typeof f.content.arrayBuffer === "function") {
                // 二进制文件 (Blob/File)
                const arrayBuffer = await f.content.arrayBuffer();
                body = new Uint8Array(arrayBuffer);
                contentType = f.content.type || "application/octet-stream";
            } else {
                // JSON文件
                const contentStr = typeof f.content === "string"
                    ? f.content
                    : JSON.stringify(f.content, null, 2);
                body = contentStr;
                contentType = "application/json";
            }
            
            const command = new PutObjectCommand({
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
```

**关键操作**：
- `PutObjectCommand`: 上传或更新对象
- `DeleteObjectCommand`: 删除对象
- 支持二进制和文本两种格式
- 上传后重新获取结构获取服务器生成的ETag

### 5. transformAsset - 资产处理

```typescript
const transformAsset = (file: File, storeFullName: string) => {
    const assetPath = `assets/${shortId()}-${file.name}`;
    // 返回S3 URI格式的AssetKey
    return `s3://${config.bucket}/${config.baseDir}/${storeFullName}/${assetPath}`;
};
```

**策略**：
- File对象转换为S3 URI格式
- URI格式：`s3://bucket/baseDir/storeName/assets/id-filename`

### 6. getAsset - 获取资产

```typescript
const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
    const client = await getS3Client();
    
    // 从S3 URI解析出bucket和key
    // 格式: s3://bucket/path/to/file
    const uri = fileKey.replace("s3://", "");
    const [bucket, ...pathParts] = uri.split("/");
    const key = pathParts.join("/");
    
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    
    const response = await client.send(command);
    
    // 将流转换为Blob
    const arrayBuffer = await response.Body?.transformToByteArray();
    const blob = new Blob([arrayBuffer], { type: response.ContentType });
    
    return blob;
};
```

**特点**：
- AssetKey使用S3 URI格式
- 使用binary格式获取原始数据
- 返回Blob对象供应用使用

## WebDAV Syncer 实现

### 核心机制

WebDAV Syncer 使用 WebDAV 协议进行文件同步，相比 GitHub 更直接简单。

### 1. fetchStructure - 获取文件结构

```typescript
const fetchStructure = async (storeFullName: string, signal?: AbortSignal) => {
    const client = await getClient();
    const storePath = `${config.baseDir}/${storeFullName}`;
    
    try {
        // 深度递归获取目录下所有文件
        const files = await client.getDirectoryContents(storePath, {
            deep: true,
            signal
        }) as FileStat[];
        
        // 转换为 StoreStructure
        return fileStatsToStructure(files, config.entryName, storePath);
    } catch (e: any) {
        if (e?.status === 404) {
            // 目录不存在，返回空结构
            return { chunks: [], assets: [], meta: { path: "", sha: "", size: 0 } };
        }
        throw e;
    }
};
```

**关键点**：
- 使用 `getDirectoryContents` 递归获取所有文件
- WebDAV 的 sha 由 `etag:lastmod:size` 组合生成
- 404 错误表示仓库未初始化

### 2. fileStatsToStructure - 结构转换

```typescript
const fileStatsToStructure = (files: FileStat[], entryName: string, basePath: string) => {
    const structure: StoreStructure = {
        chunks: [],
        assets: [],
        meta: { path: "", sha: "", etag: undefined, lastmod: "", size: 0 },
    };
    
    for (const file of files) {
        if (file.type === "directory") continue;
        
        // 获取相对路径
        const relativePath = file.filename.split(basePath)[1].replace(/^\//, "");
        
        // 根据文件名分类
        if (relativePath === "meta.json") {
            structure.meta = {
                path: relativePath,
                sha: fileStatToSha(file),  // etag:lastmod:size
                etag: file.etag,
                lastmod: file.lastmod,
                size: file.size,
            };
        } else if (relativePath.startsWith("assets/")) {
            structure.assets.push({ /* ... */ });
        } else if (relativePath.startsWith(`${entryName}-`) && relativePath.endsWith(`.json`)) {
            const startIndex = Number(
                relativePath.replace(`${entryName}-`, "").replace(".json", "")
            );
            structure.chunks.push({ path: relativePath, sha: fileStatToSha(file), startIndex });
        }
    }
    
    return structure;
};
```

**WebDAV 的 sha 计算**：
```typescript
const fileStatToSha = (file: FileStat) => {
    return `${file.etag ?? ""}:${file.lastmod ?? ""}:${file.size ?? 0}`;
};
```

### 3. fetchContent - 获取文件内容

```typescript
const fetchContent = async (storeFullName: string, files: FileLike[], signal?: AbortSignal) => {
    const client = await getClient();
    const storePath = `${config.baseDir}/${storeFullName}`;
    const results = [];
    
    // 串行获取文件内容（避免并发限制）
    for (const file of files) {
        const filePath = `${storePath}/${file.path}`;
        const content = await client.getFileContents(filePath, {
            format: "text",
            signal
        }) as string;
        
        results.push({
            ...file,
            sha: `${file.etag}:${file.lastmod}:${file.size}`,
            content: JSON.parse(content)
        });
    }
    
    return results;
};
```

**特点**：
- 串行获取文件（某些 WebDAV 服务器并发限制）
- 直接获取文本格式，然后 JSON.parse

### 4. uploadContent - 上传内容

```typescript
const uploadContent = async (storeFullName: string, files: { path: string; content: any }[], signal?: AbortSignal) => {
    const client = await getClient();
    const storePath = `${config.baseDir}/${storeFullName}`;
    
    // 确保目录存在
    await client.createDirectory(storePath, { recursive: true });
    
    // 串行处理每个文件
    for (const f of files) {
        const fullPath = `${storePath}/${f.path}`;
        
        if (f.content === null || f.content === undefined) {
            // 删除文件
            try {
                await client.deleteFile(fullPath);
            } catch (e: any) {
                if (e?.status !== 404) throw e;
            }
        } else {
            // 上传文件
            if (typeof f.content.arrayBuffer === "function") {
                // 二进制文件 (Blob/File)
                const arr = await (f.content as Blob).arrayBuffer();
                await client.putFileContents(fullPath, arr);
            } else {
                // JSON 文件
                const contentStr = typeof f.content === "string"
                    ? f.content
                    : JSON.stringify(f.content, null, 2);
                await client.putFileContents(fullPath, contentStr);
            }
        }
    }
    
    // 重新获取结构（获取新的 etag/lastmod）
    const filesList = await client.getDirectoryContents(storePath, { deep: true }) as FileStat[];
    return fileStatsToStructure(filesList, config.entryName, storePath);
};
```

**关键操作**：
- `putFileContents`: 上传或更新文件
- `deleteFile`: 删除文件
- 支持二进制和文本两种格式
- 上传后重新获取结构（获取服务器生成的 etag）

### 5. transformAsset - 资产处理

```typescript
const transformAsset = (file: File, storeFullName: string) => {
    const assetPath = `assets/${shortId()}-${file.name}`;
    return `${config.baseDir}/${storeFullName}/${assetPath}`;
};
```

**策略**：
- File 对象转换为 WebDAV 绝对路径
- 路径格式：`/{baseDir}/{storeFullName}/assets/{id}-{filename}`

### 6. getAsset - 获取资产

```typescript
const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
    const client = await getClient();
    
    // fileKey 就是完整路径
    const arrayBuffer = await client.getFileContents(fileKey, {
        format: "binary"
    }) as unknown as ArrayBuffer;
    
    return new Blob([arrayBuffer]);
};
```

**特点**：
- AssetKey 直接是 WebDAV 路径
- 使用 binary 格式获取原始数据

## 对比：GitHub vs WebDAV vs S3

| 特性 | GitHub | WebDAV | S3 |
|------|--------|--------|-----|
| **协议** | Git API (REST) | WebDAV (HTTP扩展) | S3 API (REST) |
| **认证** | OAuth Token | 用户名/密码 | AccessKey/SecretKey |
| **文件哈希** | Git SHA-1 (基于内容) | ETag:LastMod:Size (基于元数据) | ETag:LastMod:Size (MD5) |
| **上传机制** | Blob → Tree → Commit → Ref | 直接 PUT 文件 | PutObject 请求 |
| **删除文件** | Tree 中 sha=null | DELETE 请求 | DeleteObject 请求 |
| **资产存储** | raw.githubusercontent.com URL | 绝对路径 | S3 URI (s3://bucket/key) |
| **版本控制** | 完整 Git 历史 | 无版本控制 | 可选版本控制 |
| **并发支持** | 良好 | 服务器依赖（需串行） | 优秀（高并发） |
| **复杂度** | 高（需理解 Git 模型） | 低（类似文件系统） | 中（对象存储模型） |
| **可用性** | 依赖GitHub服务 | 需自建或第三方 | 广泛支持（AWS/MinIO/阿里云等） |
| **成本** | 免费（有限额） | 取决于服务商 | 按使用量付费 |

## 使用示例

### 创建 Tidal 实例

```typescript
import { createTidal } from "@/tidal";
import { createGithubSyncer } from "@/tidal/github";
import { createWebDAVSyncer } from "@/tidal/web-dav";
import { createS3Syncer } from "@/tidal/s3";

// GitHub 后端
const tidalGithub = createTidal({
    storageFactory: (storeFullName) => createIndexedDBStorage(storeFullName),
    syncerFactory: () => createGithubSyncer({
        auth: async () => ({ accessToken: "ghp_xxx" }),
        repoPrefix: "cent-journal",
        entryName: "ledger"
    }),
    itemsPerChunk: 1000,
    entryName: "ledger"
});

// WebDAV 后端
const tidalWebDAV = createTidal({
    storageFactory: (storeFullName) => createIndexedDBStorage(storeFullName),
    syncerFactory: () => createWebDAVSyncer({
        remoteUrl: "https://dav.example.com",
        username: "user",
        password: "pass",
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger"
    }),
    itemsPerChunk: 1000
});

// S3 后端 (AWS S3)
const tidalS3AWS = createTidal({
    storageFactory: (storeFullName) => createIndexedDBStorage(storeFullName),
    syncerFactory: () => createS3Syncer({
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        bucket: "my-bucket",
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger"
    }),
    itemsPerChunk: 1000
});

// S3 后端 (MinIO 自建)
const tidalS3MinIO = createTidal({
    storageFactory: (storeFullName) => createIndexedDBStorage(storeFullName),
    syncerFactory: () => createS3Syncer({
        endpoint: "https://minio.example.com",
        region: "us-east-1",
        accessKeyId: "minioadmin",
        secretAccessKey: "minioadmin",
        bucket: "cent-data",
        forcePathStyle: true,  // MinIO需要启用路径风格
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger"
    }),
    itemsPerChunk: 1000
});

// S3 后端 (阿里云OSS)
const tidalS3Aliyun = createTidal({
    storageFactory: (storeFullName) => createIndexedDBStorage(storeFullName),
    syncerFactory: () => createS3Syncer({
        endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
        region: "oss-cn-hangzhou",
        accessKeyId: "your-access-key-id",
        secretAccessKey: "your-access-key-secret",
        bucket: "your-bucket",
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger"
    }),
    itemsPerChunk: 1000
});
```

### 基本操作

```typescript
// 1. 初始化（从远程拉取数据）
await tidal.init("owner/repo-name");

// 2. 获取所有数据
const items = await tidal.getAllItems("owner/repo-name");

// 3. 获取元数据
const meta = await tidal.getMeta("owner/repo-name");

// 4. 批量操作
await tidal.batch("owner/repo-name", [
    { type: "add", item: { id: "1", name: "Item 1", createdAt: Date.now() } },
    { type: "update", item: { id: "2", name: "Updated" } },
    { type: "delete", itemId: "3" },
    { type: "meta", metaValue: { theme: "dark" } }
]);

// 5. 同步到远程
const [syncPromise, cancel] = tidal.sync();
await syncPromise;

// 6. 监听数据变化
const unsubscribe = tidal.onChange(({ bookId }) => {
    console.log(`Data changed in ${bookId}`);
});

// 7. 处理文件资产
const blob = await tidal.getAsset("asset-key", "owner/repo-name");
```

### 创建新仓库

```typescript
// 创建新的存储仓库
const { id, name } = await tidal.create("my-new-store");
// GitHub: id = "owner/cent-journal-my-new-store"
// WebDAV: id = "cent-journal-my-new-store"

// 初始化
await tidal.init(id);
```

## 高级特性

### Overlap 模式

当 `overlap=true` 时，会完全覆盖远程数据：

```typescript
await tidal.batch("owner/repo", actions, true);  // overlap=true
```

**行为**：
- 删除所有不在新数据中的远程文件
- 用于数据重置或完全同步场景

### 数据分片机制

```typescript
// itemsPerChunk = 1000
// 如果有 2500 条数据，会创建：
// - ledger-0.json (0-999)
// - ledger-1000.json (1000-1999)
// - ledger-2000.json (2000-2499)
```

**优势**：
- 只下载最新分片（如只下载 ledger-2000.json）
- 上传时只更新最新分片
- 避免单文件过大

### 哈希校验机制

```typescript
// GitHub: 基于文件内容的 Git SHA-1
// meta.json (content: "{}") → sha: "bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f"

// WebDAV: 基于元数据
// meta.json (etag: "abc", lastmod: "2024-01-01", size: 2) 
//   → sha: "abc:2024-01-01:2"
```

**校验流程**：
1. 本地缓存远程文件的 sha 列表
2. 每次同步前对比 sha
3. 只下载 sha 不同的文件

### 资产转换流程

```typescript
// 1. 用户添加带文件的数据
const action = {
    type: "add",
    item: {
        id: "1",
        image: new File([blob], "photo.jpg")  // File 对象
    }
};

// 2. batch() 调用时，File 保留在 Stash 中
await tidal.batch(store, [action]);

// 3. sync() 时，transformAssets 处理：
const [transformed, assets] = transformAssets(stashes, (file) => 
    syncer.transformAsset(file, store)
);
// transformed: [{ id: "1", image: "https://raw.../assets/abc-photo.jpg" }]
// assets: [{ file: File(...), formattedValue: "https://..." }]

// 4. 上传：
// - JSON 文件：包含 AssetKey 的数据
// - 二进制文件：实际的图片文件

// 5. 读取时：
const blob = await tidal.getAsset("https://raw.../assets/abc-photo.jpg", store);
```

## 错误处理

### 网络中断

```typescript
const [syncPromise, cancel] = tidal.sync();

// 可以取消同步
setTimeout(() => cancel(), 5000);

try {
    await syncPromise;
} catch (e) {
    if (e.name === "AbortError") {
        // 用户取消
    } else {
        // 网络错误等
    }
}
```

### 冲突处理

Tidal 采用"最后写入胜出"策略：
- 同步时总是追加新操作到最新数据
- 不支持自动合并冲突
- 建议使用 overlap 模式强制覆盖

### 存储配额

```typescript
// IndexedDB 可能超出配额
try {
    await tidal.batch(store, actions);
} catch (e) {
    if (e.name === "QuotaExceededError") {
        // 提示用户清理数据
    }
}
```

## 性能优化建议

1. **合理设置 itemsPerChunk**
   - 小文件：减少网络请求次数，但单次请求时间长
   - 大文件：增加网络请求次数，但单次请求快
   - 推荐：500-2000 条

2. **批量操作**
   ```typescript
   // 好：一次 batch 多个操作
   await tidal.batch(store, [action1, action2, action3]);
   
   // 差：多次 batch
   await tidal.batch(store, [action1]);
   await tidal.batch(store, [action2]);
   await tidal.batch(store, [action3]);
   ```

3. **按需同步**
   ```typescript
   // 只在必要时同步
   if (await tidal.hasStashes()) {
       await tidal.sync();
   }
   ```

4. **资产压缩**
   ```typescript
   // 上传前压缩图片
   const compressedFile = await compressImage(originalFile);
   await tidal.batch(store, [{ type: "add", item: { image: compressedFile } }]);
   ```

## 扩展新的 Syncer

实现 Syncer 接口即可支持新平台。以下是完整的接口实现模板和S3作为参考实现：

### Syncer 接口定义

```typescript
export type Syncer = {
    // 获取远程仓库的文件结构（不包含内容）
    fetchStructure: (storeFullName: string, signal?: AbortSignal) 
        => Promise<StoreStructure>;
    
    // 批量获取文件内容
    fetchContent: (storeFullName: string, paths: FileLike[], signal?: AbortSignal) 
        => Promise<FileWithContent[]>;
    
    // 上传文件到远程
    uploadContent: (storeFullName: string, files: { path: string; content: string | undefined }[], signal?: AbortSignal) 
        => Promise<StoreStructure>;
    
    // 将 File 对象转换为 AssetKey
    transformAsset: (file: File, storeFullName: string) => AssetKey;
    
    // 创建新的存储仓库
    createStore: (name: string) => Promise<{ id: string; name: string }>;
    
    // 获取资产文件的二进制数据
    getAsset: (fileKey: AssetKey, storeFullName: string) => Promise<Blob>;
    
    // 将资产条目转换为路径
    assetEntryToPath: (entry: FileEntry<string>, storeFullName: string) => string;
    
    // 获取用户信息
    getUserInfo: (id?: string) => Promise<UserInfo>;
    
    // 获取协作者列表
    getCollaborators: (id: string) => Promise<UserInfo[]>;
    
    // 获取所有存储仓库
    fetchAllStore: () => Promise<string[]>;
};
```

### 实现新 Syncer 的步骤

1. **定义配置类型**：包含连接所需的所有参数
2. **实现文件哈希计算**：用于判断文件是否变更
3. **实现获取文件结构**：列出远程所有文件的元数据
4. **实现文件内容读取**：批量下载文件内容
5. **实现文件上传**：支持创建、更新、删除文件
6. **实现资产管理**：处理二进制文件的上传和下载
7. **实现仓库管理**：创建新仓库、列出所有仓库

### 参考实现：S3 Syncer 核心代码

```typescript
import type { Syncer } from "@/tidal";

export const createS3Syncer = (cfg: S3Config): Syncer => {
    // 1. 初始化客户端
    const getS3Client = async () => {
        const { S3Client } = await import("@aws-sdk/client-s3");
        return new S3Client({
            endpoint: cfg.endpoint,
            region: cfg.region,
            credentials: {
                accessKeyId: cfg.accessKeyId,
                secretAccessKey: cfg.secretAccessKey,
            },
        });
    };

    // 2. 实现 fetchStructure：列出所有文件
    const fetchStructure = async (storeFullName: string, signal?: AbortSignal) => {
        const client = await getS3Client();
        const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        
        const command = new ListObjectsV2Command({
            Bucket: cfg.bucket,
            Prefix: `${cfg.baseDir}/${storeFullName}/`,
        });
        
        const response = await client.send(command, { abortSignal: signal });
        
        // 将S3对象转换为StoreStructure
        return s3ObjectsToStructure(response.Contents, cfg.entryName);
    };

    // 3. 实现 fetchContent：获取文件内容
    const fetchContent = async (storeFullName: string, files: FileLike[], signal?: AbortSignal) => {
        const client = await getS3Client();
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        
        const results = [];
        for (const file of files) {
            const command = new GetObjectCommand({
                Bucket: cfg.bucket,
                Key: `${cfg.baseDir}/${storeFullName}/${file.path}`,
            });
            
            const response = await client.send(command, { abortSignal: signal });
            const content = await response.Body?.transformToString();
            
            results.push({
                ...file,
                content: JSON.parse(content || "{}"),
            });
        }
        return results;
    };

    // 4. 实现 uploadContent：上传文件
    const uploadContent = async (storeFullName: string, files: any[], signal?: AbortSignal) => {
        const client = await getS3Client();
        const { PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        
        for (const f of files) {
            const key = `${cfg.baseDir}/${storeFullName}/${f.path}`;
            
            if (f.content === null) {
                // 删除文件
                await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
            } else {
                // 上传文件
                const body = typeof f.content === "string" 
                    ? f.content 
                    : JSON.stringify(f.content);
                await client.send(new PutObjectCommand({ 
                    Bucket: cfg.bucket, 
                    Key: key, 
                    Body: body 
                }));
            }
        }
        
        return await fetchStructure(storeFullName, signal);
    };

    // 5. 实现资产管理
    const transformAsset = (file: File, storeFullName: string) => {
        return `s3://${cfg.bucket}/${cfg.baseDir}/${storeFullName}/assets/${shortId()}-${file.name}`;
    };
    
    const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
        // 从S3 URI解析并下载
        const [bucket, ...pathParts] = fileKey.replace("s3://", "").split("/");
        const key = pathParts.join("/");
        
        const client = await getS3Client();
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        
        const arrayBuffer = await response.Body?.transformToByteArray();
        return new Blob([arrayBuffer]);
    };

    // 6. 返回完整的Syncer接口
    return {
        fetchStructure,
        fetchContent,
        uploadContent,
        transformAsset,
        getAsset,
        assetEntryToPath: (a, store) => a.formattedValue.replace(`s3://${cfg.bucket}/${cfg.baseDir}/${store}/`, ""),
        createStore: async (name) => { /* 实现 */ },
        getUserInfo: async (id) => { /* 实现 */ },
        getCollaborators: async (id) => { /* 实现 */ },
        fetchAllStore: async () => { /* 实现 */ },
    };
};
```

### 配置验证工具

每个Syncer应该提供配置验证函数：

```typescript
// S3配置验证
export const checkS3Config = async (config: S3Config) => {
    const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ /* ... */ });
    
    try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
        return true;
    } catch (e) {
        throw new Error(`S3 connection failed: ${e.message}`);
    }
};

// WebDAV配置验证
export const checkWebDAVConfig = async (config: WebDAVConfig) => {
    const client = createClient(config.remoteUrl, { /* ... */ });
    
    try {
        await client.getDirectoryContents("/");
        return true;
    } catch (e) {
        throw new Error(`WebDAV connection failed: ${e.message}`);
    }
};
```

## 总结

Tidal 通过以下设计实现了高效的增量同步：

1. **抽象层设计**：Syncer 接口屏蔽平台差异
2. **操作日志**：Stash 表记录所有变更，支持离线操作
3. **哈希校验**：只同步变动的文件
4. **数据分片**：避免单文件过大
5. **资产转换**：自动处理二进制文件
6. **解耦存储**：支持多种数据库后端

这使得 Tidal 可以：
- 在多设备间无冲突同步
- 支持离线优先的工作流
- 适应不同的云存储平台
- 随数据增长保持性能稳定
