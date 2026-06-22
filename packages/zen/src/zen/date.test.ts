import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { getZenStyleName, resolveZenStyleName, ZEN_STYLE_NAMES } from "./date";

describe("resolveZenStyleName", () => {
    const now = dayjs("2026-06-22T12:00:00");

    it.each(ZEN_STYLE_NAMES)("accepts the host style %s", (style) => {
        expect(resolveZenStyleName(style, now)).toBe(style);
    });

    it.each([undefined, null, "", "unknown"])(
        "falls back to the daily style for %s",
        (style) => {
            expect(resolveZenStyleName(style, now)).toBe(getZenStyleName(now));
        },
    );

    it("keeps the existing daily rotation when no override is provided", () => {
        const nextDay = now.add(1, "day");
        expect(resolveZenStyleName(undefined, nextDay)).toBe(
            ZEN_STYLE_NAMES[
                (ZEN_STYLE_NAMES.indexOf(getZenStyleName(now)) + 1) %
                    ZEN_STYLE_NAMES.length
            ],
        );
    });
});
