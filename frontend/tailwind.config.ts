import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#17663D",
          mid: "#22C55E",
          light: "#EAF6EF",
          dark: "#071109",
        },
        app: {
          bg: "#EEF3F0",
          surface: "#FFFFFF",
          border: "#D9E6DE",
          text: "#101B14",
          dim: "#65786D",
        },
        tv: {
          bg: "#EEF3F0",
          surface: "#FFFFFF",
          surface2: "#F8FAFB",
          border: "#D9E6DE",
          text: "#101B14",
          dim: "#65786D",
          accent: "#22C55E",
        },
        state: {
          critica: "#DC2626",
          atencion: "#D97706",
          ok: "#16A34A",
          info: "#2563EB",
          neutral: "#64748B",
        },
      },
      boxShadow: {
        brand: "0 18px 60px rgba(23,102,61,0.34)",
        panel: "0 4px 12px rgba(0,0,0,0.08)",
        deck: "0 30px 80px rgba(0,0,0,0.34)",
        critical: "0 4px 14px #DC262644",
      },
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
