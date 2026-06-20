import { toast } from "sonner";
import { LoadingProvider, loading } from "./loading";
import { PromptProvider, prompt } from "./prompt";
import { S3AuthProvider, showS3Auth } from "./s3";
import { showWebDAVAuth, WebDAVAuthProvider } from "./web-dav";

export function ModalProvider() {
    return (
        <>
            <PromptProvider />
            <LoadingProvider />
            <WebDAVAuthProvider />
            <S3AuthProvider />
        </>
    );
}

const modal = {
    loading,
    prompt,
    webDavAuth: showWebDAVAuth,
    s3Auth: showS3Auth,
    toast,
};

export type Modal = typeof modal;

export default modal;
