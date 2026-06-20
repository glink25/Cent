// utils/download.ts
async function fetchAsBlob(url: string): Promise<Blob> {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok)
        throw new Error(
            `Failed to fetch "${url}": ${res.status} ${res.statusText}`,
        );
    return await res.blob();
}

function guessMimeFromName(name: string): string {
    const ext = (name.split(".").pop() || "").toLowerCase();
    switch (ext) {
        case "txt":
            return "text/plain";
        case "json":
            return "application/json";
        case "pdf":
            return "application/pdf";
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "csv":
            return "text/csv";
        case "html":
            return "text/html";
        case "zip":
            return "application/zip";
        default:
            return "application/octet-stream";
    }
}

/**
 * Download helper that supports URL, Blob and File.
 * Prefer navigator.share when it's available and can share files.
 */
export const download = async (
    source: string | Blob | File,
    name: string,
): Promise<void> => {
    // Normalize environment check
    const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
    const supportsShare = !!(
        nav &&
        typeof nav.share === "function" &&
        typeof nav.canShare === "function"
    );

    // Helper to try Web Share with a File instance
    async function tryShare(file: File): Promise<boolean> {
        try {
            if (
                supportsShare &&
                nav.canShare &&
                nav.canShare({ files: [file] })
            ) {
                // navigator.share may reject; bubble error to caller if desired
                await nav.share({ files: [file], title: name });
                return true;
            }
        } catch (err) {
            // share failed (user canceled or other). Return false to fall back to download.
            // We intentionally swallow here and let fallback handle actual download.
            console.warn("navigator.share failed or was cancelled:", err);
        }
        return false;
    }

    // If source is already a File
    if (source instanceof File) {
        // Try share first
        if (await tryShare(source)) return;

        // Fallback to download via object URL
        const url = URL.createObjectURL(source);
        try {
            // IE / old Edge fallback
            if (
                typeof navigator !== "undefined" &&
                (navigator as any).msSaveOrOpenBlob
            ) {
                (navigator as any).msSaveOrOpenBlob(source, name);
                return;
            }
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            // Some browsers require it to be in DOM
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
        return;
    }

    // If source is a Blob (but not File)
    if (source instanceof Blob) {
        // Wrap blob into a File so we can try share with a filename
        const file = new File([source], name, {
            type: source.type || guessMimeFromName(name),
        });
        if (await tryShare(file)) return;

        // Fallback to object URL download
        const url = URL.createObjectURL(source);
        try {
            if (
                typeof navigator !== "undefined" &&
                (navigator as any).msSaveOrOpenBlob
            ) {
                (navigator as any).msSaveOrOpenBlob(source, name);
                return;
            }
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
        return;
    }

    // Else source is string (URL)
    if (typeof source === "string") {
        // If Web Share is supported we need a File: fetch the resource as blob
        if (supportsShare) {
            try {
                const blob = await fetchAsBlob(source);
                const file = new File([blob], name, {
                    type: blob.type || guessMimeFromName(name),
                });
                if (await tryShare(file)) return;
                // if share failed or not allowed, fall through to download fallback below
            } catch (err) {
                console.warn("Failed to fetch resource for sharing:", err);
                // continue to fallback download attempts
            }
        }

        // Fallback: try anchor download with download attribute (fast, doesn't fetch)
        try {
            const a = document.createElement("a");
            a.href = source;
            a.download = name;
            // For cross-origin URLs the download attribute might be ignored by browser.
            // We still try this fast path first.
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.remove();

            // NOTE: some browsers ignore download for cross-origin resources.
            // If you want to guarantee filename for cross-origin URLs, fetch and use blob:
            // const blob = await fetchAsBlob(source);
            // ... object URL download as above ...
            return;
        } catch (err) {
            console.warn(
                "Anchor download failed, falling back to fetch+objectURL:",
                err,
            );
        }

        // Last-resort: fetch the URL and download blob (guarantees filename but costs bandwidth)
        const blob = await fetchAsBlob(source);
        const urlObj = URL.createObjectURL(blob);
        try {
            if (
                typeof navigator !== "undefined" &&
                (navigator as any).msSaveOrOpenBlob
            ) {
                (navigator as any).msSaveOrOpenBlob(blob, name);
                return;
            }
            const a = document.createElement("a");
            a.href = urlObj;
            a.download = name;
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(urlObj);
        }
        return;
    }

    // If we reached here, the input type is unsupported
    throw new TypeError(
        "Unsupported source type for download. Expect string | Blob | File.",
    );
};
