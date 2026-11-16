import { Download } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { toast } from "sonner";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { attachmentToFile, resolveAttachment } from "@/utils/attachment";
import { download } from "@/utils/download";
import { Button } from "../ui/button";
import type { AttachmentViewerOptions } from ".";
import "./style.css";

type LoadedAttachment = { resource: Blob | string; url: string };

export default function AttachmentSlider({
    bookId,
    images,
    index: initialIndex,
    portalContainer,
    onClose,
}: AttachmentViewerOptions & {
    portalContainer: HTMLElement;
    onClose?: () => void;
}) {
    const t = useIntl();
    const [index, setIndex] = useState(initialIndex);
    const [loaded, setLoaded] = useState<Record<number, LoadedAttachment>>({});
    const [failed, setFailed] = useState<Record<number, boolean>>({});
    const [attempt, setAttempt] = useState(0);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const currentBookId = useBookStore((state) => state.currentBookId);
    const validBook = bookId === currentBookId;

    useEffect(() => {
        if (!validBook) onClose?.();
    }, [validBook, onClose]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: A retry deliberately reloads the same sources and replaces their object URLs.
    useEffect(() => {
        let active = true;
        const urls: string[] = [];
        setLoaded({});
        setFailed({});
        if (validBook)
            images.forEach((source, i) => {
                resolveAttachment(source, bookId)
                    .then((resource) => {
                        if (!active) return;
                        const url =
                            typeof resource === "string"
                                ? resource
                                : URL.createObjectURL(resource);
                        if (typeof resource !== "string") urls.push(url);
                        setLoaded((previous) => ({
                            ...previous,
                            [i]: { resource, url },
                        }));
                    })
                    .catch(() => {
                        if (active)
                            setFailed((previous) => ({
                                ...previous,
                                [i]: true,
                            }));
                    });
            });
        return () => {
            active = false;
            for (const url of urls) URL.revokeObjectURL(url);
        };
    }, [images, bookId, attempt, validBook]);

    const retry = () => setAttempt((value) => value + 1);
    const error = (
        <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 text-white"
        >
            <span>{t("attachment-load-failed")}</span>
            <Button
                variant="secondary"
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    retry();
                }}
            >
                {t("attachment-retry")}
            </Button>
        </div>
    );
    const loading = (
        <output className="inline-flex text-white" aria-label={t("loading")}>
            <i
                className="icon-[mdi--loading] size-6 animate-spin"
                aria-hidden="true"
            />
        </output>
    );

    const save = async () => {
        const item = loaded[index];
        if (!item || failed[index] || savingRef.current || !validBook) return;
        savingRef.current = true;
        setSaving(true);
        try {
            const file = await attachmentToFile(images[index], item.resource);
            if (useBookStore.getState().currentBookId !== bookId) return;
            await download(file, file.name);
        } catch {
            toast.error(t("attachment-download-failed"));
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    if (!validBook) return null;
    return (
        <>
            <PhotoSlider
                visible
                images={images.map((_, i) => ({
                    key: `${i}-${attempt}`,
                    ...(loaded[i]
                        ? { src: loaded[i].url }
                        : {
                              width: 320,
                              height: 160,
                              render: () => (failed[i] ? error : loading),
                          }),
                }))}
                index={index}
                onIndexChange={setIndex}
                onClose={onClose ?? (() => {})}
                loop={false}
                photoClosable={false}
                pullClosable={false}
                portalContainer={portalContainer}
                className="cent-attachment-viewer"
                loadingElement={
                    <div className="flex justify-center">{loading}</div>
                }
                brokenElement={({ src }: { src: string }) => (
                    <BrokenAttachment
                        src={src}
                        loaded={loaded}
                        setFailed={setFailed}
                    >
                        {error}
                    </BrokenAttachment>
                )}
                bannerVisible={false}
            />
            <div className="cent-attachment-controls">
                <div className="cent-attachment-navigation">
                    <ViewerButton
                        label={t("attachment-previous")}
                        icon="icon-[mdi--chevron-left]"
                        disabled={index === 0}
                        onClick={() => setIndex(index - 1)}
                    />
                    <output
                        className="cent-attachment-count"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span>{index + 1}</span>
                        <span
                            className="cent-attachment-count-divider"
                            aria-hidden="true"
                        >
                            /
                        </span>
                        <span className="cent-attachment-count-total">
                            {images.length}
                        </span>
                    </output>
                    <ViewerButton
                        label={t("attachment-next")}
                        icon="icon-[mdi--chevron-right]"
                        disabled={index === images.length - 1}
                        onClick={() => setIndex(index + 1)}
                    />
                </div>
                <ViewerButton
                    className="cent-attachment-download"
                    label={t("attachment-download")}
                    icon={
                        saving ? (
                            "icon-[mdi--loading] animate-spin"
                        ) : (
                            <Download aria-hidden="true" />
                        )
                    }
                    disabled={!loaded[index] || failed[index] || saving}
                    onClick={() => {
                        void save();
                    }}
                />
            </div>
        </>
    );
}

function BrokenAttachment({
    src,
    loaded,
    setFailed,
    children,
}: {
    src: string;
    loaded: Record<number, LoadedAttachment>;
    setFailed: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    children: React.ReactNode;
}) {
    const index = Object.keys(loaded).find(
        (key) => loaded[Number(key)].url === src,
    );
    useEffect(() => {
        if (index !== undefined)
            setFailed((previous) =>
                previous[Number(index)]
                    ? previous
                    : { ...previous, [index]: true },
            );
    }, [index, setFailed]);
    return children;
}

function ViewerButton({
    label,
    icon,
    className,
    ...props
}: {
    label: string;
    icon: string | ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            {...props}
            title={label}
            aria-label={label}
            className={`cent-attachment-button ${className ?? ""}`}
        >
            {typeof icon === "string" ? (
                <i className={`${icon} size-5`} aria-hidden="true" />
            ) : (
                icon
            )}
        </Button>
    );
}
