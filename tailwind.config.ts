import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  safelist: [
    "bg-amber-100", "bg-amber-200", "bg-amber-300", "bg-amber-400",
    "text-amber-700", "text-amber-800", "text-amber-900",
    "border-amber-200", "border-amber-300", "border-amber-400",
    "bg-yellow-300", "bg-yellow-400", "text-yellow-900", "border-yellow-500",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#fafafa",
        card: "#ffffff",
        border: "#e5e5e5",
        muted: "#6b7280",
        accent: "#1e3a8a",
        ink: "#111111",
        navy: "#1e3a8a",
        "navy-deep": "#0f1d4a",
        "navy-light": "#3b5bbf",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Hiragino Sans", "Yu Gothic", "Meiryo", "sans-serif"],
        display: ["var(--font-display)", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
