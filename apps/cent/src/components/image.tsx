import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import { useBookStore } from "@/store/book";
import { resolveAttachment } from "@/utils/attachment";

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
        setUrl("");
        resolveAttachment(source, book)
            .then((file) => {
                if (!active) return;
                if (typeof file === "string") setUrl(file);
                else showFile(file);
            })
            .catch((error) => {
                if (!active) return;
                console.error(error);
                setStatus("error");
            });

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
