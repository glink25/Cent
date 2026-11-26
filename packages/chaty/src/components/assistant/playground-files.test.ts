import {
    callPlaygroundFiles,
    type PlaygroundFiles,
} from "@glink25/agent-core/playground/files";
import { expect, it } from "vitest";

it("applies exact edits without altering historical file snapshots", () => {
    let files: PlaygroundFiles = {};
    const call = (method: string, params = {}) =>
        callPlaygroundFiles(
            {
                read: () => files,
                update: (apply) => {
                    files = apply(files);
                },
            },
            { method, ...params },
        );
    const path = "draft/index.html";
    expect(call("write", { path, text: "<h1>画板</h1>" })).toEqual({ path });
    expect(call("list")).toEqual([{ path, bytes: 15 }]);
    const checkpoint = files;
    expect(() =>
        call("replace", { path, oldText: "h1", newText: "h2" }),
    ).toThrow();
    call("replace", { path, oldText: "画板", newText: "Drawing" });
    expect(call("read", { path, range: { start: 4, end: 11 } })).toBe(
        "Drawing",
    );
    expect(() => call("write", { path: "dir/../other", text: "x" })).toThrow();
    call("remove", { path });
    expect(call("list")).toEqual([]);
    expect(checkpoint[path]).toBe("<h1>画板</h1>");
});

it("limits individual files to 5 MiB and current files to 10 MiB in UTF-8", () => {
    let files: PlaygroundFiles = {};
    const store = {
        read: () => files,
        update: (apply: (files: PlaygroundFiles) => PlaygroundFiles) => {
            files = apply(files);
        },
    };
    const limit = 5 * 1024 * 1024;
    const exactlyFiveMiB = "画".repeat(Math.floor(limit / 3)) + "ab";
    const write = (path: string, text: string) =>
        callPlaygroundFiles(store, { method: "write", path, text });

    write("first", exactlyFiveMiB);
    write("second", exactlyFiveMiB);
    expect(() => write("first", exactlyFiveMiB + "x")).toThrow(
        "File size limit exceeded",
    );
    expect(() =>
        callPlaygroundFiles(store, {
            method: "replace",
            path: "first",
            oldText: "ab",
            newText: "abc",
        }),
    ).toThrow("File size limit exceeded");
    expect(() => write("third", "x")).toThrow(
        "Conversation file limit exceeded",
    );
    expect(callPlaygroundFiles(store, { method: "list" })).toEqual([
        { path: "first", bytes: limit },
        { path: "second", bytes: limit },
    ]);
});
