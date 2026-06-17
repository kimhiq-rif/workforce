import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1E3A8A",
          accent: "#FF6A00",
        },
        surface: "#F5F6FA",
        "border-default": "#E5E7EB",
        status: {
          live: "#06B6D4",
          finished: "#22C55E",
          dayoff: "#3B82F6",
          check: "#F59E0B",
          waiting: "#F97316",
          critical: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "Sarabun", "system-ui", "sans-serif"],
      },
      fontSize: {
        "screen-title": ["31px", { lineHeight: "1.2", fontWeight: "700" }],
        "section-head": ["19px", { lineHeight: "1.3", fontWeight: "600" }],
        "card-head": ["17px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-op": ["15px", { lineHeight: "1.5" }],
        "secondary-en": ["13px", { lineHeight: "1.4" }],
        "data-cell": ["14px", { lineHeight: "1.4" }],
        "key-number": ["28px", { lineHeight: "1.1", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
};

export default config;
