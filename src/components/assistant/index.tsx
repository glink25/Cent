import { type ComponentProps, lazy, Suspense } from "react";

const AssistantButtonEntrance = lazy(
    () => import("@/components/assistant/entrance"),
);
type AssistantButtonProps = ComponentProps<typeof AssistantButtonEntrance>;

const AssistantButton = (args: AssistantButtonProps) => {
    return (
        <Suspense fallback={<div className="w-10 h-8" />}>
            <AssistantButtonEntrance {...args} />
        </Suspense>
    );
};

export default AssistantButton;
