#!/usr/bin/env node
/**
 * Publish a release tag.
 *
 * Usage:
 *   pnpm run publish 0.0.3
 *   pnpm run publish v0.0.3
 *  node scripts/publish.mjs 0.1.0
 *
 * Behavior:
 *   1. Normalize the argument to `vX.Y.Z`.
 *   2. Resolve the remote tracked by the current branch (git config
 *      `branch.<current>.remote`, same source Cursor / VS Code read).
 *   3. Delete the tag locally and on that remote (if it exists).
 *   4. Re-create the tag at HEAD and push it to that remote.
 */

import { spawnSync } from "node:child_process";

function run(cmd, args, { allowFail = false } = {}) {
    const res = spawnSync(cmd, args, { stdio: "inherit" });
    if (res.status !== 0 && !allowFail) process.exit(res.status ?? 1);
    return res.status === 0;
}

function capture(cmd, args) {
    const res = spawnSync(cmd, args, { encoding: "utf8" });
    return { status: res.status ?? 1, stdout: (res.stdout ?? "").trim() };
}

const raw = process.argv[2];
if (!raw) {
    console.error("usage: pnpm run publish <version>  (e.g. 0.0.3 or v0.0.3)");
    process.exit(1);
}

const tag = raw.startsWith("v") ? raw : `v${raw}`;
if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
    console.error(`invalid version: ${raw} (expected X.Y.Z)`);
    process.exit(1);
}

const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch.status !== 0 || !branch.stdout || branch.stdout === "HEAD") {
    console.error("cannot resolve current branch (detached HEAD?)");
    process.exit(1);
}

// `branch.<name>.remote` — the same upstream config Cursor / VS Code use.
const remoteCfg = capture("git", ["config", "--get", `branch.${branch.stdout}.remote`]);
if (remoteCfg.status !== 0 || !remoteCfg.stdout) {
    console.error(
        `branch '${branch.stdout}' has no upstream remote configured.\n` +
            `set one with:  git branch --set-upstream-to=<remote>/<branch>`,
    );
    process.exit(1);
}
const remote = remoteCfg.stdout;

const remoteUrl = capture("git", ["remote", "get-url", remote]).stdout;
console.log(`→ branch '${branch.stdout}' → remote '${remote}' (${remoteUrl})`);
console.log(`→ publishing ${tag}`);

const hasLocal = capture("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).status === 0;
if (hasLocal) {
    console.log(`→ deleting local tag ${tag}`);
    run("git", ["tag", "-d", tag]);
}

console.log(`→ deleting remote tag ${tag} on ${remote} (if any)`);
run("git", ["push", remote, `:refs/tags/${tag}`], { allowFail: true });

console.log(`→ creating tag ${tag} at HEAD`);
run("git", ["tag", tag]);

console.log(`→ pushing tag ${tag} to ${remote}`);
run("git", ["push", remote, tag]);

console.log(`✔ ${tag} published to ${remote}`);
