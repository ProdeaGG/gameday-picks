import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        turf: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        gameday: {
          gold: "#f59e0b",
          goldLight: "#fbbf24",
          slate: "#0f172a",
          card: "#1e293b",
          border: "#334155",
        },
      },
      fontFamily: {
        pixel: ['"Courier New"', "Courier", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
