import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#fafafa",
        card: "#ffffff",
        border: "#e5e5e5",
        muted: "#6b7280",
        accent: "#111111",
        ink: "#111111",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Yu Gothic", "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
