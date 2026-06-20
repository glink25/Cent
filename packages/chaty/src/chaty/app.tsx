import MainAssistant from "../components/assistant/main";
import type { RuntimeConfig } from "./host";

const AiChat = ({ runtime }: { runtime: RuntimeConfig }) => {
    return (
        <MainAssistant.Root runtime={runtime}>
            <MainAssistant.Content />
        </MainAssistant.Root>
    );
};

export default AiChat;
