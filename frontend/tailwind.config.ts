import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        excel: {
          green: "#217346",
          greenDark: "#185C37",
          gridline: "#d0d7de",
          headerBg: "#f3f2f1",
          headerBorder: "#c7ccd1",
          selectionBorder: "#107c41",
          selectionFill: "rgba(33,115,70,0.08)",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Calibri", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
