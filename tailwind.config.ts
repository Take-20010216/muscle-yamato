import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        surface: "#0e0e0e",
        card: "#161616",
        border: "#222222",
        muted: "#8a8a8a",
        accent: "#e8e8e8",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Yu Gothic", "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
