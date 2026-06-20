const preset = require("@glink25/tailwind-config");
/** @type {import('tailwindcss').Config} */
module.exports = {
    presets: [preset],
    content: ["./src/**/*.{js,ts,jsx,tsx}", "!./docs/**/*"],
};
