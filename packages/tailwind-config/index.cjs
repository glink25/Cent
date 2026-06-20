const plugin = require("tailwindcss/plugin");

/**
 * 共享 Tailwind preset：cent / chaty / zen 三个包统一的 darkMode、keyframes、
 * animations 与 scrollbar-hidden 工具类的单一来源，避免各包重复定义、彼此漂移。
 *
 * 注意：`@iconify/tailwind4`、`tailwindcss-animate`、`tw-animate-css` 等通过各包
 * 入口 CSS 的 `@plugin` / `@import` 指令声明，不放在这里。
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
	darkMode: "class",
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
				wiggle: {
					"0%, 100%": { transform: "rotate(0deg)" },
					"10%, 30%, 50%, 70%, 90%": { transform: "rotate(-3deg)" },
					"20%, 40%, 60%, 80%": { transform: "rotate(3deg)" },
				},
			},
			animation: {
				"overlay-show": "overlay-show 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				"content-show": "content-show 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				"slide-from-right":
					"slide-from-right 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				"collapse-open": "collapse-open 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				"collapse-close":
					"collapse-close 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				"dynamic-bg": "dynamic-bg 3s ease-in-out infinite",
				wiggle: "wiggle 1.5s ease-in-out infinite",
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
