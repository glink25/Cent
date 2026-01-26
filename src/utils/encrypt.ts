/**
 * 加密工具函数
 * 使用对称加密（AES-GCM + PBKDF2），与 demo.html 中的实现完全一致
 */

/**
 * 检查 Web Crypto API 是否可用
 */
function isWebCryptoAvailable(): boolean {
    return (
        typeof crypto !== "undefined" &&
        typeof crypto.subtle !== "undefined" &&
        typeof crypto.subtle.generateKey === "function"
    );
}

/**
 * 生成对称加密密钥（随机密码字符串）
 * 与 demo.html 中的实现一致：随机生成一个 12 位的密码
 * @returns 随机生成的密钥字符串
 */
export function generateSymmetricKey(): string {
    return Math.random().toString(36).slice(-12);
}

/**
 * 解密 AES-GCM 加密的数据
 * 与 demo.html 中的 decryptData 函数完全一致
 * @param cipherBase64 Base64 编码的加密数据
 * @param ivBase64 Base64 编码的初始化向量
 * @param password 用于派生密钥的密码字符串
 * @returns Promise<string> 解密后的原始数据
 */
export async function decryptAES(
    cipherBase64: string,
    ivBase64: string,
    password: string,
): Promise<string> {
    if (!isWebCryptoAvailable()) {
        throw new Error("Web Crypto API 不可用");
    }

    if (!cipherBase64 || !ivBase64 || !password) {
        throw new Error("加密数据、IV 和密码不能为空");
    }

    const enc = new TextEncoder();

    // 1. 还原密钥 (必须与后端 PBKDF2 逻辑一致)
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("relayr-salt"),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
    );

    // 2. 解码数据
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const encryptedData = Uint8Array.from(atob(cipherBase64), (c) =>
        c.charCodeAt(0),
    );

    // 3. 执行解密
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedData,
    );

    return new TextDecoder().decode(decrypted);
}
