import { sourceDigest } from "@glink25/agent-core/assistant/context";
import { expect, it } from "vitest";
import type { History, Message } from "../../assistant";
import { branchConversation } from "./conversation";
import type { Chat } from "./state";

it("forks the exact history prefix and keeps only matching context", () => {
    const earlier = { role: "user", raw: "earlier", id: "earlier" } as const;
    const reply: Message = {
        role: "assistant",
        raw: "answer",
        formatted: { answer: "answer" },
    };
    const history: History = [
        earlier,
        { role: "assistant", raw: "called", formatted: { tools: [] } },
        {
            role: "tool",
            raw: "result",
            formatted: { name: "query", params: {}, returns: "result" },
        },
        reply,
        { role: "user", id: "later", raw: "later" },
    ];
    const state = {
        version: 1 as const,
        summary: "summary",
        compactions: 1,
        coveredThroughId: "earlier",
        sourceDigest: sourceDigest([earlier]),
    };
    const event = {
        id: "kept",
        anchorId: "earlier",
        coveredThroughId: "earlier",
    };
    const source: Chat = {
        id: "original",
        scope: "book",
        history,
        contextState: state,
        contextEvents: [event, { id: "future", anchorId: "later" }],
        contextStatus: "compacting",
    };
    expect(branchConversation(source, reply, "branch")).toEqual({
        id: "branch",
        scope: "book",
        isBranch: true,
        history: history.slice(0, 4),
        contextState: state,
        contextEvents: [event],
    });
    expect(source.history).toHaveLength(5);
    expect(
        branchConversation({ ...source, pending: true }, reply, "b"),
    ).toBeUndefined();
    const laterState = { ...state, coveredThroughId: "later" };
    expect(
        branchConversation({ ...source, contextState: laterState }, reply, "b")
            ?.contextState,
    ).toBeUndefined();
});
