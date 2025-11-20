import { toast } from "sonner";
import { LoadingProvider, loading } from "./loading";
import { PromptProvider, prompt } from "./prompt";
import { showWebDAVAuth, WebDAVAuthProvider } from "./web-dav";

export function ModalProvider() {
    return (
        <>
            <PromptProvider />
            <LoadingProvider />
            <WebDAVAuthProvider />
        </>
    );
}

const modal = {
    loading,
    prompt,
    webDavAuth: showWebDAVAuth,
    toast,
};

export type Modal = typeof modal;

export default modal;
