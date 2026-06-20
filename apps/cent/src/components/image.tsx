import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
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
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        if (!(source instanceof File)) {
            // 普通字符串 url
            if (StorageAPI.getOnlineAsset) {
                cacheInDB(StorageAPI.getOnlineAsset, GetOnlineAssetsCacheKey)?.(
                    source,
                    book,
                )
                    .then((file) => {
                        if (file === undefined) {
                            setUrl(source);
                            return;
                        }
                        const objectUrl = URL.createObjectURL(file);
                        objectUrlRef.current = objectUrl;
                        setUrl(objectUrl);
                    })
                    .catch((error) => {
                        console.error(error);
                        setStatus("error");
                    });
                return;
            }
            setUrl(source);
            return () => {};
        }
        // 如果传入的是 File，创建 blob url
        const objectUrl = URL.createObjectURL(source);
        objectUrlRef.current = objectUrl;
        setUrl(objectUrl);

        // 组件卸载或 source 改变时清理
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [source]);

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
