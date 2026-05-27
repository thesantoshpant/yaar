/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Be Vietnam Pro", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Be Vietnam Pro", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic tokens — defined as CSS variables in index.css so they flip
        // automatically between light and dark mode. Use these everywhere.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        // "Warm Buddy" palette. brand = deep teal (the trust/secondary color used
        // for links, icons, focus rings, the sidebar, and active states). gold =
        // marigold/saffron (the primary action color). coral = the accent pop.
        brand: {
          50: "#ecf7f6",
          100: "#cfeae9",
          200: "#a6dcd9",
          300: "#73c7c4",
          400: "#3fa9a6",
          500: "#1f8c8a",
          600: "#216867",
          700: "#1a5150",
          800: "#143d3c",
          900: "#0e2c2b",
          950: "#071a19",
        },
        gold: {
          200: "#ffe1a8",
          300: "#ffc24d",
          400: "#f9b21f",
          500: "#f4a300",
          600: "#cc8800",
          ink: "#5a3d00", // readable text/icon color to sit on a marigold fill
        },
        coral: {
          300: "#ffb1c0",
          400: "#ff8aa3",
          500: "#ff5c8a",
          600: "#e5396f",
        },
        // Legacy accent scales remapped onto the warm palette so existing
        // `violet-*` / `fuchsia-*` usages across pages adopt Warm Buddy with no
        // per-file edits: violet -> teal (matches brand), fuchsia -> coral.
        violet: {
          100: "#cfeae9",
          200: "#a6dcd9",
          300: "#73c7c4",
          400: "#3fa9a6",
          500: "#1f8c8a",
          600: "#216867",
          700: "#1a5150",
        },
        fuchsia: {
          100: "#ffe0e7",
          200: "#ffc9d4",
          300: "#ffb1c0",
          400: "#ff8aa3",
          500: "#ff5c8a",
          600: "#e5396f",
          700: "#c4205a",
        },
      },
      boxShadow: {
        // Soft, multi-layered "ambient" shadow tinted with the plum ink (Warm Buddy).
        soft: "0 4px 20px -2px rgba(26, 26, 46, 0.05), 0 1px 2px rgba(26, 26, 46, 0.04)",
        lift: "0 2px 6px rgba(26, 26, 46, 0.06), 0 18px 40px rgba(26, 26, 46, 0.12)",
        glow: "0 0 0 1px rgba(244, 163, 0, 0.18), 0 12px 36px rgba(244, 163, 0, 0.28)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
