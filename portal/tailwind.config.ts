import type { Config } from "tailwindcss";

// Palette mirrors the Claude SEO report style guide (CLAUDE.md):
// navy #1e3a5f, dark gold #b8860b, forest green #2d6a4f, warm amber #d4740e,
// deep red #c53030, warm cream #faf9f7.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1e3a5f",
        gold: "#b8860b",
        forest: "#2d6a4f",
        amber: "#d4740e",
        danger: "#c53030",
        cream: "#faf9f7",
      },
    },
  },
  plugins: [],
};

export default config;
