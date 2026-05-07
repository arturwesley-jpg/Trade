/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3b82f6",
          dark: "#2563eb",
        },
        secondary: {
          DEFAULT: "#8b5cf6",
          dark: "#7c3aed",
        },
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        bg: {
          primary: "#0a0a0a",
          secondary: "#141414",
          tertiary: "#1e1e1e",
        },
        text: {
          primary: "#ffffff",
          secondary: "#a0a0a0",
        },
        border: "#2a2a2a",
      },
    },
  },
  plugins: [],
};
