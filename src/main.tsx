import "./utils/shim";

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import Login from "./components/login";
import { initIntl, LocaleProvider } from "./locale/index";
import { usePreferenceStore } from "./store/preference";

const Rooot = lazy(() => import("./route"));

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
