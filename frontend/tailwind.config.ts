import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 'navy' keys kept so existing classes (bg-navy-600 etc.) work unchanged,
        // but the values are now emerald — recolors the whole app at once.
        navy: { 50:'#EAF3EE', 500:'#2E8B5E', 600:'#1F6B4A', 700:'#16513A' },
        gold: { 400:'#E0A93C', 500:'#C08A2D' },
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
