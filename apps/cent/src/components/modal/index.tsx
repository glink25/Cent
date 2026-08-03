import { toast } from "sonner";
import { LoadingProvider, loading } from "./loading";
import { PromptProvider, prompt } from "./prompt";
import { S3AuthProvider, showS3Auth } from "./s3";
import { showWebDAVAuth, WebDAVAuthProvider } from "./web-dav";
import {
    showWebDAVUserSelect,
    WebDAVUserSelectProvider,
} from "./web-dav-user";

export function ModalProvider() {
    return (
        <>
            <PromptProvider />
            <LoadingProvider />
            <WebDAVAuthProvider />
            <WebDAVUserSelectProvider />
            <S3AuthProvider />
        </>
    );
}

const modal = {
    loading,
    prompt,
    webDavAuth: showWebDAVAuth,
    webDavUser: showWebDAVUserSelect,
    s3Auth: showS3Auth,
    toast,
};

export type Modal = typeof modal;

export default modal;
