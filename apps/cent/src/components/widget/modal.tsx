import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import createConfirmProvider from "../confirm";

const Content = createContext<ReactNode>(null);

function ModalContent() {
    return useContext(Content);
}

export default function WidgetModal({
    id,
    title,
    children,
    onOpen,
    onClose,
    onExited,
}: {
    id: string;
    title: string;
    children: ReactNode;
    onOpen: (id: string, cancel: () => void) => void;
    onClose: (id: string) => void;
    onExited: (id: string) => void;
}) {
    const [[Provider, , open]] = useState(() =>
        createConfirmProvider(ModalContent, {
            dialogTitle: title,
            contentClassName:
                "flex h-full w-full max-h-full max-w-full flex-col overflow-hidden rounded-none pt-[var(--safe-area-inset-top)] pb-[var(--safe-area-inset-bottom)] pl-[var(--safe-area-inset-left)] pr-[var(--safe-area-inset-right)] sm:h-auto sm:max-h-[90dvh] sm:w-[90vw] sm:max-w-[640px] sm:rounded-md sm:p-0",
            initialFocus: "[data-widget-modal-title]",
            onExitComplete: () => onExited(id),
        }),
    );

    useEffect(() => {
        let mounted = true;
        let cancel: (() => void) | undefined;
        // Wait until the provider has mounted. Strict Mode may replay setup first.
        queueMicrotask(() => {
            if (!mounted) return;
            const controller = open();
            cancel = controller.cancel;
            onOpen(id, cancel);
            void controller.promise.catch(() => {
                if (mounted) onClose(id);
            });
        });
        return () => {
            mounted = false;
            cancel?.();
        };
    }, [open, onOpen, onClose, id]);

    return (
        <Content.Provider value={children}>
            <Provider />
        </Content.Provider>
    );
}
