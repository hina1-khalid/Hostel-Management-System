/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#16213E",
          light: "#1F2E52",
          dark: "#0F1730",
        },
        gold: {
          DEFAULT: "#C9A227",
          light: "#DDBE5C",
          dark: "#A6821A",
        },
        paper: "#F8F9FB",
        success: "#2F855A",
        danger: "#C0392B",
        warning: "#B7791F",
        muted: "#64748B",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
