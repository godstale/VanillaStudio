import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import themePreset from './design/tailwind.preset';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [themePreset],
  plugins: [tailwindcssAnimate],
} satisfies Config;
