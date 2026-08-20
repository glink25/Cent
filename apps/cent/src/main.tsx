import "./utils/shim";
import "@/utils/fetch-proxy";

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import Login from "./components/login";
import { initIntl, LocaleProvider } from "./locale/index";
import { measure } from "./measurement";
import { usePreferenceStore } from "./store/preference";
import { register as registerLaunchQueue } from "./utils/launch-queue";
import { lazyWithReload } from "./utils/lazy";
import { registerPWAUpdates } from "./utils/pwa";

registerPWAUpdates();

const Rooot = lazyWithReload(() => import("./route"));

measure("app_open");

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

import("./agent-api").then(({ bootAgentApi }) => {
    void bootAgentApi();
});
