export async function blobToBase64(blob: Blob): Promise<string> {
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
 * 将 Base64 字符串（Data URL 格式）转换为 File 对象。
 * * @param base64 完整的 Base64 Data URL 字符串，例如 "data:image/png;base64,iVBORw0KGgo..."
 * @param defaultFileName 默认的文件名（如果 base64 字符串中不包含文件名）。
 * @returns Promise<File> 转换后的 File 对象。
 */
export async function base64ToFile(
    base64: string,
    defaultFileName: string = "file",
): Promise<File> {
    // 1. 提取 MIME 类型和 Base64 数据部分
    const parts = base64.split(";base64,");
    if (parts.length !== 2) {
        throw new Error("Invalid Base64 string format. Expected a Data URL.");
    }

    const meta = parts[0];
    const base64Data = parts[1];

    const mimeMatch = meta.match(/data:(.*?)(;|$)/);
    const mimeType =
        mimeMatch && mimeMatch[1] ? mimeMatch[1] : "application/octet-stream";

    // 尝试从 Data URL 的元数据中提取文件名，或使用默认值
    let fileName = defaultFileName;
    const nameMatch = meta.match(/name=([^;]+)/i);
    if (nameMatch && nameMatch[1]) {
        try {
            // 文件名可能经过 URL 编码
            fileName = decodeURIComponent(nameMatch[1]);
        } catch (e) {
            fileName = nameMatch[1];
        }
    } else {
        // 如果没有文件名，尝试根据 MIME 类型添加扩展名
        const extensionMatch = mimeType.match(/\/(.+)/);
        if (
            extensionMatch &&
            extensionMatch[1] &&
            fileName.indexOf(".") === -1
        ) {
            fileName = `${defaultFileName}.${extensionMatch[1]}`;
        } else if (fileName.indexOf(".") === -1) {
            // 如果仍然没有扩展名，就用默认文件名
            fileName = defaultFileName;
        }
    }

    // 2. Base64 解码为二进制字符串
    // atob() 仅适用于仅包含 Latin1 字符的字符串，但 Base64 解码的二进制数据是安全的
    const byteString = atob(base64Data);

    // 3. 将二进制字符串转换为 Uint8Array
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // 4. 使用 Uint8Array 创建 Blob 对象
    const blob = new Blob([ia], { type: mimeType });

    // 5. 使用 Blob 和文件名创建 File 对象
    // File 构造函数接受 BlobPart[] (这里是 Blob) 和文件名, 以及可选的选项 (比如 MIME 类型和最后修改时间)
    // 注意：File 构造函数在非浏览器环境（如 Node.js）中可能不可用。
    return new File([blob], fileName, {
        type: mimeType,
        lastModified: Date.now(),
    });
}
