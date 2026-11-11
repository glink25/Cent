import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import { StorageAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";
import { cacheInDB } from "@/utils/cache";
import { GetOnlineAssetsCacheKey } from "@/utils/constant";

// 降低弹窗过渡动画时图片渲染时的抖动
function Delayed({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    useLayoutEffect(() => {
        setTimeout(() => {
            setVisible(true);
        }, 200);
    }, []);
    if (!visible) {
        return null;
    }
    return children;
}

type SmartImageCoreProps = {
    source: string | File;
    className?: string;
    alt?: string;
    style?: CSSProperties;
};
export function SmartImageCore({
    source,
    className,
    alt,
    style,
}: SmartImageCoreProps) {
    const [status, setStatus] = useState("loading");
    const [url, setUrl] = useState<string>(
        typeof source === "string" ? source : "",
    );
    const book = useBookStore((state) => state.currentBookId);

    useEffect(() => {
        let active = true;
        let objectUrl: string | undefined;
        const showFile = (file: Blob) => {
            objectUrl = URL.createObjectURL(file);
            setUrl(objectUrl);
        };

        setStatus("loading");
        if (source instanceof File) {
            showFile(source);
        } else if (book && StorageAPI.getOnlineAsset) {
            setUrl("");
            cacheInDB(StorageAPI.getOnlineAsset, GetOnlineAssetsCacheKey)?.(
                source,
                book,
            )
                .then((file) => {
                    if (!active) return;
                    if (file) showFile(file);
                    else setUrl(source);
                })
                .catch((error) => {
                    if (!active) return;
                    console.error(error);
                    setStatus("error");
                });
        } else {
            setUrl(source);
        }

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [book, source]);

    const onLoad = useCallback(() => {
        setStatus("loaded");
    }, []);

    if (url === "") return null;
    return (
        <img
            data-state={status}
            src={url}
            className={className}
            alt={alt}
            style={style}
            onLoad={onLoad}
        />
    );
}

export default function SmartImage(props: SmartImageCoreProps) {
    return (
        <Delayed>
            <SmartImageCore {...props} />
        </Delayed>
    );
}
