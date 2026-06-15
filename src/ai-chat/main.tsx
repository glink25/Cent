import "../utils/shim";
import "@/utils/fetch-proxy";

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";

import { initIntl, LocaleProvider } from "../locale/index";
import { usePreferenceStore } from "../store/preference";
import { lazyWithReload } from "../utils/lazy";

const AiChat = lazyWithReload(() => import("./app"));

const lang = usePreferenceStore.getState().locale;
initIntl(lang).then(() => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <LocaleProvider>
                <Suspense>
                    <AiChat />
                </Suspense>
            </LocaleProvider>
        </StrictMode>,
    );
});
