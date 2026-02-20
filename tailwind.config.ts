import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f7f5",
        ink: "#111111",
        muted: "#6b6b6b",
        line: "#e8e8e8"
      }
    }
  },
  plugins: []
};

export default config;
