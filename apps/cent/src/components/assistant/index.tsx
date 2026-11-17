import { lazy, Suspense } from "react";

const AssistantButtonEntrance = lazy(
    () => import("@/components/assistant/entrance"),
);

const AssistantButton = () => {
    return (
        <Suspense fallback={null}>
            <AssistantButtonEntrance />
        </Suspense>
    );
};

export default AssistantButton;
