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
        background: "var(--background)",
        foreground: "var(--foreground)",

        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
          muted: "var(--surface-muted)",
          hover: "var(--surface-hover)",
        },

        app: {
          border: "var(--border)",
          "border-strong": "var(--border-strong)",
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },

        brand: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
        },

        sidebar: {
          DEFAULT: "var(--sidebar)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
          text: "var(--sidebar-text)",
          muted: "var(--sidebar-muted)",
        },

        intelligence: {
          DEFAULT: "var(--ai)",
          soft: "var(--ai-soft)",
        },
      },

      borderRadius: {
        appSm: "var(--radius-sm)",
        appMd: "var(--radius-md)",
        appLg: "var(--radius-lg)",
        appXl: "var(--radius-xl)",
      },

      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
      },

      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "Arial",
          "Helvetica",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
