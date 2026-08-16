import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16181D",
        page: "#E4E2DD",
        paper: "#FFFFFF",
        error: "#C8321E",
        pass: "#1F6F4A",
        rule: "#B8B4AC",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
