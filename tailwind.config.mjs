const plugin = require("tailwindcss/plugin");
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
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
            keyframes: {
                "overlay-show": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "content-show": {
                    from: {
                        opacity: "0",
                        transform: "scale(0.96)",
                    },
                    to: { opacity: "1", transform: "scale(1)" },
                },
                "slide-from-right": {
                    from: {
                        transform: "translateX(100%)",
                    },
                    to: {
                        transform: "translateX(0)",
                    },
                },
                "collapse-open": {
                    from: {
                        height: "0",
                    },
                    to: {
                        height: "var(--radix-collapsible-content-height)",
                    },
                },
                "collapse-close": {
                    from: {
                        height: "var(--radix-collapsible-content-height)",
                    },
                    to: {
                        height: "0",
                    },
                },
                "dynamic-bg": {
                    // 动画开始时使用 --color-start
                    "0%, 100%": { "background-color": "var(--color-start)" },
                    // 动画中间时使用 --color-end
                    "50%": { "background-color": "var(--color-end)" },
                },
            },
            animation: {
                "overlay-show":
                    "overlay-show 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                "content-show":
                    "content-show 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                "slide-from-right":
                    "slide-from-right 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                "collapse-open":
                    "collapse-open 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                "collapse-close":
                    "collapse-close 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                "dynamic-bg": "dynamic-bg 3s ease-in-out infinite",
            },
        },
    },
    plugins: [
        plugin(({ addUtilities }) => {
            addUtilities({
                ".scrollbar-hidden": {
                    "::-webkit-scrollbar": {
                        display: "none",
                    },
                    /* 针对 IE 和 Edge */
                    "-ms-overflow-style": "none",
                    /* 针对 Firefox */
                    "scrollbar-width": "none",
                },
            });
        }),
    ],
};
