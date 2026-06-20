/**
 * 计算 Git blob SHA-1（与 GitHub 上传后一致）
 * @param {File} file - 来自 input[type="file"] 的 File 对象
 * @returns {Promise<string>} - 返回 40 位十六进制 SHA-1
 */
export async function computeGitBlobSha1(file: File) {
    // 1. 获取文件内容为 ArrayBuffer
    const content = await file.arrayBuffer();
    const size = content.byteLength;

    // 2. 构造 header 字节："blob " + size + "\0"
    const encoder = new TextEncoder();
    const headerStr = `blob ${size}\0`;
    const header = encoder.encode(headerStr);

    // 3. 拼接 header 与内容
    const combined = new Uint8Array(header.byteLength + content.byteLength);
    combined.set(header, 0);
    combined.set(new Uint8Array(content), header.byteLength);

    // 4. 使用 SubtleCrypto 计算 SHA-1
    const digestBuffer = await crypto.subtle.digest("SHA-1", combined.buffer);

    // 5. 转成十六进制字符串
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    const sha1 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return sha1;
}
