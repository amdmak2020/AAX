import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#080808",
        coal: "#111111",
        fog: "#f6f2ea",
        pearl: "#fffaf0",
        mint: "#42f6b1",
        coral: "#ff6b57",
        lemon: "#ffe66d",
        violet: "#9b7cff"
      },
      boxShadow: {
        glow: "0 0 60px rgba(66, 246, 177, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
