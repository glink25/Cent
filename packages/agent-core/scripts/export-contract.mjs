import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ledgerToolDefinitions } from "../src/ledger-tools.ts";

const fixtures = JSON.parse(
    readFileSync(new URL("../contracts/ledger-fixtures.json", import.meta.url)),
);
writeFileSync(
    resolve(process.argv[2], "agent-contract.json"),
    JSON.stringify(
        {
            ...fixtures,
            tools: ledgerToolDefinitions,
        },
        null,
        2,
    ) + "\n",
);
