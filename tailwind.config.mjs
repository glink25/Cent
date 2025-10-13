const plugin = require("tailwindcss/plugin");
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
        "overlay-show": "overlay-show 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "content-show": "content-show 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-from-right": "slide-from-right 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "collapse-open": "collapse-open 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "collapse-close": "collapse-close 150ms cubic-bezier(0.16, 1, 0.3, 1)",
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
