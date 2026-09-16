import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
      },
      // Type scale (Inter): H1/H2 = extrabold, Body = regular, Action = semibold
      fontSize: {
        h1: ["24px", { lineHeight: "1.3", fontWeight: "800" }],
        h2: ["18px", { lineHeight: "1.35", fontWeight: "800" }],
        "body-xl": ["18px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-l": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "action-l": ["14px", { lineHeight: "1.3", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};
export default config;
