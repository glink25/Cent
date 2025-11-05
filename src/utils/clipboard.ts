/**
 * 尝试读取剪贴板中的内容，包括文本和文件等。
 *
 * @returns {Promise<{text: string | null, items: ClipboardItem[] | null, files: File[] | null}>}
 * 返回一个包含读取到的文本、原始 ClipboardItem 数组和 File 对象数组的 Promise。
 * 如果读取失败或被拒绝，则返回相应字段为 null。
 */
export async function readClipboard(): Promise<{
    text: string | null;
    items: ClipboardItem[] | null;
    files: File[] | null;
}> {
    let clipboardText: string | null = null;
    let clipboardItems: ClipboardItem[] | null = null;
    let clipboardFiles: File[] | null = null;

    // 1. 检查 Clipboard API 和 read() 方法支持
    if (navigator.clipboard && navigator.clipboard.read) {
        try {
            // 尝试使用 read() 读取所有类型的剪贴板数据（包括文件/图片等）
            clipboardItems = await navigator.clipboard.read();

            const files: File[] = [];
            const tempTextBlobs: Blob[] = []; // 临时存储纯文本 Blob

            for (const item of clipboardItems) {
                // 遍历所有可用的 MIME 类型
                for (const type of item.types) {
                    const blob = await item.getType(type);

                    // 检查是否是文件类型，例如 image/png, image/jpeg 等
                    if (
                        type.startsWith("image/") ||
                        type.startsWith("application/")
                    ) {
                        // 将 Blob 转换为 File 对象 (对于文件或图像)
                        const file = new File(
                            [blob],
                            `clipboard-file-${Date.now()}`,
                            {
                                type: type,
                                lastModified: Date.now(),
                            },
                        );
                        files.push(file);
                    }

                    // 如果是纯文本类型，先保存 Blob，后面用 readText() 的结果覆盖
                    if (type === "text/plain" && !clipboardText) {
                        tempTextBlobs.push(blob);
                    }
                }
            }

            clipboardFiles = files.length > 0 ? files : null;

            // 如果未通过 item.getType 提取到文本，尝试用 readText() 获取文本
            if (tempTextBlobs.length > 0 && !clipboardText) {
                // 通常来说， readText() 更可靠地获取纯文本内容
                const textBlob = tempTextBlobs[0];
                clipboardText = await textBlob.text();
            }
        } catch (err) {
            console.warn(
                "使用 navigator.clipboard.read() 失败，尝试 readText()。",
                err,
            );
            // Fallback 到 readText()
            if (navigator.clipboard.readText) {
                try {
                    clipboardText = await navigator.clipboard.readText();
                } catch (errText) {
                    console.error(
                        "使用 navigator.clipboard.readText() 失败。",
                        errText,
                    );
                }
            }
        }
    }

    // 2. 传统/降级方案 (仅适用于文本的获取)
    // 注意: document.execCommand('paste') 是已废弃的方法，并且在浏览器安全模型下
    // 几乎无法在没有用户直接手势（如粘贴事件）的情况下读取内容。
    // 此处提供一个仅供参考的文本降级方案，但**不推荐使用**，因为它很少能在现代浏览器中成功。

    if (!clipboardText) {
        console.warn(
            "尝试使用 document.execCommand('paste') 降级方案获取文本（仅限文本）。",
        );

        // 必须在可编辑元素中执行 'paste' 命令
        const tempTextArea = document.createElement("textarea");
        tempTextArea.style.position = "fixed";
        tempTextArea.style.top = "0";
        tempTextArea.style.left = "0";
        tempTextArea.style.opacity = "0"; // 隐藏元素
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();

        try {
            // 执行粘贴命令
            const success = document.execCommand("paste");
            if (success) {
                // 粘贴成功，读取内容
                clipboardText = tempTextArea.value;
            } else {
                console.warn("execCommand('paste') 失败，通常是由于安全限制。");
            }
        } catch (e) {
            console.error("execCommand('paste') 抛出异常。", e);
        } finally {
            // 移除临时元素
            document.body.removeChild(tempTextArea);
        }
    }

    return {
        text: clipboardText,
        items: clipboardItems,
        files: clipboardFiles,
    };
}
