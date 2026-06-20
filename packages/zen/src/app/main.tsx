import "../index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getHostBridge, Zen } from "../index";

const host = getHostBridge();
const element = document.getElementById("root");
if (!element) throw new Error("#root is missing");
const root = createRoot(element);
root.render(
    <StrictMode>
        {host ? (
            <Zen host={host} />
        ) : (
            <div style={{ padding: 24 }}>ZenHost is not available.</div>
        )}
    </StrictMode>,
);
