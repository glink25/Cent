import {
    Component,
    lazy,
    type ReactNode,
    Suspense,
    useEffect,
    useState,
} from "react";
import { useIntl } from "@/locale";
import type { AttachmentSource } from "@/utils/attachment";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

export type AttachmentViewerOptions = {
    bookId?: string;
    images: AttachmentSource[];
    index: number;
};

class ViewerBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function ViewerShell({
    edit,
    onCancel,
}: {
    edit?: AttachmentViewerOptions;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [Viewer, setViewer] = useState(() => lazy(() => import("./slider")));

    useEffect(() => {
        if (!container) return;
        // React's wheel listener is passive. Cancel the browser's scroll/zoom
        // with a native listener, while still letting PhotoSlider handle it.
        const preventBrowserZoom = (event: Event) => {
            if (event.cancelable) event.preventDefault();
        };
        const events = ["wheel", "gesturestart", "gesturechange"];
        const options = { passive: false, capture: true };
        for (const event of events) {
            container.addEventListener(event, preventBrowserZoom, options);
        }
        return () => {
            for (const event of events) {
                container.removeEventListener(
                    event,
                    preventBrowserZoom,
                    options,
                );
            }
        };
    }, [container]);
    const feedback = (failed: boolean) => (
        <div
            className="flex h-full flex-col items-center justify-center gap-4 text-white"
            role={failed ? "alert" : "status"}
        >
            {failed ? (
                <span>{t("attachment-load-failed")}</span>
            ) : (
                <output className="inline-flex" aria-label={t("loading")}>
                    <i
                        className="icon-[mdi--loading] size-6 animate-spin"
                        aria-hidden="true"
                    />
                </output>
            )}
            {failed && (
                <Button
                    variant="secondary"
                    onClick={() => {
                        setViewer(() => lazy(() => import("./slider")));
                        setAttempt((value) => value + 1);
                    }}
                >
                    {t("attachment-retry")}
                </Button>
            )}
        </div>
    );
    return (
        <div
            ref={setContainer}
            className="cent-attachment-stage relative h-full w-full bg-black text-white"
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                data-attachment-close
                aria-label={t("attachment-close")}
                title={t("attachment-close")}
                className="cent-attachment-button cent-attachment-close absolute right-[calc(var(--safe-area-inset-right)+20px)] top-[calc(var(--safe-area-top)+20px)] z-[3] text-white hover:bg-white/15 hover:text-white"
                onClick={onCancel}
            >
                <i className="icon-[mdi--close] size-5" aria-hidden="true" />
            </Button>
            {container && edit && (
                <ViewerBoundary key={attempt} fallback={feedback(true)}>
                    <Suspense fallback={feedback(false)}>
                        <Viewer
                            {...edit}
                            portalContainer={container}
                            onClose={onCancel}
                        />
                    </Suspense>
                </ViewerBoundary>
            )}
        </div>
    );
}

function ViewerTitle() {
    const t = useIntl();
    return t("attachment-viewer-title");
}

// Share the application's focus, z-index and optional history/Back stack.
const [AttachmentViewerProvider, , openAttachmentViewer] =
    createConfirmProvider(ViewerShell, {
        dialogTitle: <ViewerTitle />,
        contentClassName:
            "h-dvh w-screen max-h-none max-w-none rounded-none overflow-hidden bg-black",
        fade: true,
        swipe: false,
        initialFocus: "[data-attachment-close]",
    });

export { AttachmentViewerProvider, openAttachmentViewer };
