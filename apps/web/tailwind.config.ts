import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))", primary: "hsl(var(--primary))",
        muted: "hsl(var(--muted))", border: "hsl(var(--border))",
        accent: "hsl(var(--accent))", destructive: "hsl(var(--destructive))"
      },
      borderRadius: { xl: "calc(var(--radius) + 4px)", lg: "var(--radius)", md: "calc(var(--radius) - 2px)" }
    }
  },
  plugins: []
} satisfies Config;
