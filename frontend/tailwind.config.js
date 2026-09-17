/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f1a",
          900: "#121828",
          800: "#1a2236",
          700: "#242f4a",
        },
        paper: {
          50: "#f7f8fb",
          100: "#eef0f6",
          200: "#e0e4ee",
        },
        accent: {
          DEFAULT: "#4f6bff",
          soft: "#8fa2ff",
          glow: "#aab8ff",
        },
        ok: "#2dd4a7",
        warn: "#f5a623",
        err: "#ef5b5b",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,15,26,0.06), 0 8px 24px rgba(11,15,26,0.08)",
        glow: "0 0 0 1px rgba(79,107,255,0.25), 0 0 24px rgba(79,107,255,0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(79,107,255,0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(79,107,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(79,107,255,0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-ring": "pulseRing 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};