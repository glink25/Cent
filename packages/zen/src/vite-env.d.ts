/// <reference types="vite/client" />

declare module "*.md?raw" {
    const content: string;
    export default content;
}

interface Window {
    __ZEN_FALLBACK__?: boolean;
}
