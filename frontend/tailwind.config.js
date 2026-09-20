/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          hover: "rgb(var(--primary-hover) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          bg: "rgb(var(--accent) / 0.12)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          bg: "rgb(var(--success-bg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          bg: "rgb(var(--warning-bg) / <alpha-value>)",
        },
        error: {
          DEFAULT: "rgb(var(--error) / <alpha-value>)",
          bg: "rgb(var(--error-bg) / <alpha-value>)",
        },
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "'Inter'", "ui-sans-serif", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["40px", "48px"],
        title: ["26px", "34px"],
        section: ["17px", "26px"],
        body: ["15px", "24px"],
        small: ["13px", "20px"],
        tiny: ["12px", "16px"],
      },
      boxShadow: {
        overlay: "0 12px 40px rgba(0, 0, 0, 0.4)",
        "overlay-lg": "0 24px 64px rgba(0, 0, 0, 0.55)",
        hairline: "inset 0 1px 0 0 rgb(var(--border) / 0.6)",
        ember: "0 0 0 1px rgb(var(--primary) / 0.45), 0 8px 24px -8px rgb(var(--primary) / 0.45)",
      },
      borderRadius: {
        control: "6px",
        container: "10px",
      },
    },
  },
  plugins: [],
};