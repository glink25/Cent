import "../utils/shim";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { AiChatConfig } from "../components/assistant/tools";

import AiChat from "./app";
import { loadHostRuntimeConfig } from "./host";

const root = document.getElementById("root");
if (!root) {
    throw new Error("Root element not found.");
}

loadHostRuntimeConfig(AiChatConfig).then((runtime) => {
    createRoot(root).render(
        <StrictMode>
            <AiChat runtime={runtime} />
        </StrictMode>,
    );
});
