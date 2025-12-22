import { StorageAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";
import {
    type CSSProperties,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

class ImageCache {
    private cache = new Map<string, string>();
    private max = 50;

    constructor(max = 50) {
        this.max = max;
    }

    get(key: string) {
        const item = this.cache.get(key);
        if (item) {
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key: string, value: string) {
        if (this.cache.has(key)) return;
        if (this.cache.size >= this.max) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                const val = this.cache.get(firstKey);
                this.cache.delete(firstKey);
                // Clean up object URLs to prevent memory leaks
                if (val && val.startsWith("blob:")) {
                    URL.revokeObjectURL(val);
                }
            }
        }
        this.cache.set(key, value);
    }
}

// Global cache to persist across re-renders and scrolling in virtual lists
const globalImageCache = new ImageCache(100);

export default function SmartImage({
    source,
    className,
    alt,
    style,
    compressWidth,
}: {
    source: string | File;
    className?: string;
    alt?: string;
    style?: CSSProperties;
    compressWidth?: number;
}) {
    const [status, setStatus] = useState("loading");
    const [url, setUrl] = useState<string>("");
    
    // We only need this ref to cleanup if we created a blob URL *internally* without cache,
    // or if we decide to enforce cleanup on unmount for non-cached items.
    // However, with our caching strategy, the cache largely owns the URLs.
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        // Generate a cache key if apply
        const cacheKey =
            typeof source === "string"
                ? `${source}-${compressWidth ?? "full"}`
                : undefined;

        // 1. Check Cache
        if (cacheKey) {
            const cached = globalImageCache.get(cacheKey);
            if (cached) {
                setUrl(cached);
                setStatus("loaded");
                return;
            }
        }
        
        const book = useBookStore.getState().currentBookId;
        
        const loadAndProcess = async () => {
            let fileOrUrl: File | Blob | string = source;

            // 2. Resolve remote files if needed
            if (typeof source === "string" && !source.startsWith("blob:")) {
                // Try to get online asset if it's a path/id
                if (StorageAPI.getOnlineAsset && book) {
                   try {
                        const file = await StorageAPI.getOnlineAsset(source, book);
                        if (file) {
                             fileOrUrl = file;
                        }
                   } catch {
                       // ignore, treat source as direct URL
                   }
                }
            }

            // 3. Compress if requested and we have a File/Blob
            if (
                compressWidth &&
                (fileOrUrl instanceof File || fileOrUrl instanceof Blob)
            ) {
                 try {
                    const compressedUrl = await compressImage(fileOrUrl, compressWidth);
                    setUrl(compressedUrl);
                    setStatus("loaded");
                    if (cacheKey) {
                        globalImageCache.set(cacheKey, compressedUrl);
                    }
                    return;
                } catch (e) {
                    console.error("SmartImage compression failed", e);
                    // Fallback to original processing
                }
            }
            
            // 4. Default handling (no compression or compression failed)
            if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
                 const objectUrl = URL.createObjectURL(fileOrUrl);
                 objectUrlRef.current = objectUrl;
                 setUrl(objectUrl);
                 // We can optionally cache this too if we want to avoid re-creating object URLs for the same file object,
                 // but typically File objects change identity. If cacheKey exists (string source), we can cache it.
                 if (cacheKey) {
                      globalImageCache.set(cacheKey, objectUrl);
                 }
            } else {
                 setUrl(fileOrUrl as string);
            }
        };

        loadAndProcess();

        return () => {
            // If we created a local object URL that wasn't cached (or if we want to be safe),
            // typically we rely on the cache to revoke. 
            // If the cache owns it, we SHOULD NOT revoke it here because other components (virtual list) might use it.
            // ONLY Revoke if we didn't use the global cache or if it's a one-off.
            // For this implementation, we rely on LRU eviction to revoke.
        };
    }, [source, compressWidth]);

    const onLoad = useCallback(() => {
        setStatus("loaded");
    }, []);
    const onError = useCallback(() => {
        setStatus("error");
    }, []);

    if (!url) return <div className={className} style={style} />;

    return (
        <img
            data-state={status}
            src={url}
            className={className}
            alt={alt}
            style={style}
            onLoad={onLoad}
            onError={onError}
        />
    );
}

// Utility to compress image
async function compressImage(file: File | Blob, maxWidth: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Scale down
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                
                // Better quality for downsampling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob/url
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(URL.createObjectURL(blob));
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, file.type || "image/jpeg", 0.8); // 0.8 quality
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}
