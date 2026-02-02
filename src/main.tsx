import "./utils/shim";
import "@/utils/fetch-proxy";

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import Login from "./components/login";
import { initIntl, LocaleProvider } from "./locale/index";
import { usePreferenceStore } from "./store/preference";
import { register as registerLaunchQueue } from "./utils/launch-queue";
import { lazyWithReload } from "./utils/lazy";

const Rooot = lazyWithReload(() => import("./route"));

const lang = usePreferenceStore.getState().locale;
initIntl(lang).then(() => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <LocaleProvider>
                <Suspense>
                    <Rooot />
                </Suspense>
                <Login />
            </LocaleProvider>
        </StrictMode>,
    );
});

registerLaunchQueue();
