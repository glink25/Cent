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
                "flex flex-col overflow-hidden max-h-[90dvh] w-[95vw] max-w-[640px] p-4 sm:p-5",
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
