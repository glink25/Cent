import { omit } from "lodash-es";

export function parseAIResponse(text: string) {
    const extract = (tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
        return text.match(regex)?.[1]?.trim();
    };

    const toolRaw = extract("Tool");
    let toolCall = null;
    if (toolRaw) {
        const lines = toolRaw.split("\n");
        const params: any = {};
        lines.forEach((l) => {
            const [k, v] = l.split("=");
            if (k && v) params[k.trim()] = v.trim();
        });
        toolCall = {
            function: params.function,
            arguments: omit(params, "function"),
        };
    }

    return {
        title: extract("TITLE"),
        thought: extract("Thought"),
        tool: toolCall,
        answer: extract("Answer"),
    };
}
