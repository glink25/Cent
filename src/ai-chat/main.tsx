import "../utils/shim";
import "@/utils/fetch-proxy";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";

import { initIntl, LocaleProvider } from "../locale/index";
import { usePreferenceStore } from "../store/preference";
import AiChat from "./app";

const lang = usePreferenceStore.getState().locale;
initIntl(lang).then(() => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <LocaleProvider>
                <AiChat />
            </LocaleProvider>
        </StrictMode>,
    );
});
