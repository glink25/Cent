import { describe, expect, it } from "vitest";
import { mergeCustomParams } from "./provider";

describe("mergeCustomParams", () => {
    const generated = {
        model: "default-model",
        stream: true,
        temperature: 0.7,
        thinking: { type: "disabled", budget: 100 },
        messages: [{ role: "user", content: "hello" }],
    };

    it("keeps the generated body unchanged for legacy configs", () => {
        expect(mergeCustomParams(generated)).toBe(generated);
    });

    it("adds arbitrary standard JSON values", () => {
        expect(
            mergeCustomParams(generated, {
                reasoning_effort: "max",
                metadata: [true, 1, null, { source: "cent" }],
            }),
        ).toEqual({
            ...generated,
            reasoning_effort: "max",
            metadata: [true, 1, null, { source: "cent" }],
        });
    });

    it("lets custom parameters override ordinary generated fields", () => {
        expect(
            mergeCustomParams(generated, {
                model: "custom-model",
                stream: false,
                temperature: null,
                messages: [],
            }),
        ).toMatchObject({
            model: "default-model",
            stream: true,
            temperature: null,
            messages: [{ role: "user", content: "hello" }],
        });
    });

    it("uses shallow merging for nested objects and arrays", () => {
        const result = mergeCustomParams(generated, {
            thinking: { type: "enabled" },
            messages: [{ role: "system", content: "override" }],
        });

        expect(result.thinking).toEqual({ type: "enabled" });
        expect(result.messages).toEqual([{ role: "user", content: "hello" }]);
    });

    it("silently protects protocol-specific core fields", () => {
        const googleBody = {
            contents: [{ role: "user", parts: [{ text: "hello" }] }],
            systemInstruction: { parts: [{ text: "system" }] },
            tools: [{ functionDeclarations: [] }],
        };

        expect(
            mergeCustomParams(googleBody, {
                contents: [],
                systemInstruction: null,
                tools: [],
                generationConfig: { temperature: 0.2 },
            }),
        ).toEqual({
            ...googleBody,
            generationConfig: { temperature: 0.2 },
        });
    });

    it("rejects invalid synced custom parameter data", () => {
        expect(() => mergeCustomParams(generated, [] as never)).toThrowError(
            "AI customParams must be a JSON object",
        );
        expect(() =>
            mergeCustomParams(generated, { invalid: Number.NaN } as never),
        ).toThrowError("AI customParams must be a JSON object");
    });
});
