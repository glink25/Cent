const preset = require("@glink25/tailwind-config");
/** @type {import('tailwindcss').Config} */
module.exports = {
    presets: [preset],
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
        "!./docs/**/*",
        // 直接扫描 chaty / zen 的源码：cent 用自己这一份 Tailwind 统一生成三个包的
        // 工具类，源码内单次构建，彻底避免引入第二份编译后的 Tailwind（重复打包 +
        // cascade layer 冲突的根因）。
        "../../packages/chaty/src/**/*.{js,ts,jsx,tsx}",
        "../../packages/zen/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Semantic color tokens (mapped to CSS variables).
            // Use classes like `bg-semantic-expense`, `text-semantic-income-medium`.
            colors: {
                semantic: {
                    // strong / primary usage for expense/income
                    expense: "var(--color-expense)",
                    // '-medium' mappings point to legacy aliases so we can
                    // change component usages without altering visual colors.
                    "expense-medium": "var(--color-expense-medium-legacy)",
                    "expense-muted": "var(--color-expense-400)",
                    income: "var(--color-income)",
                    "income-medium": "var(--color-income-medium-legacy)",
                    "income-muted": "var(--color-income-400)",
                },
            },
        },
    },
};
