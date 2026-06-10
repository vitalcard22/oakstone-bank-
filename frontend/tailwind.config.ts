import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50:'#e8edf5', 500:'#1A3460', 600:'#0D1F3C', 700:'#080F1E' },
        gold: { 400:'#E8B84B', 500:'#C4922A' },
      },
      fontFamily: {
        sans: ['Inter','-apple-system','sans-serif'],
        mono: ['JetBrains Mono','monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
