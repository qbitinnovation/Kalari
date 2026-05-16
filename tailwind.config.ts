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
        primary: {
          50: '#fdf8ee',
          100: '#f9edcd',
          200: '#f2da99',
          300: '#e9bf5f',
          400: '#e1a233',
          500: '#d6841e',
          600: '#ba6618',
          700: '#9a4c17',
          800: '#7e3e19',
          900: '#683418',
          950: '#3c1a0a',
        },
      },
    },
  },
  plugins: [],
};
export default config;
