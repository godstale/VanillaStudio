import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so HyperFrames can open dist/index.html from any directory.
export default defineConfig({
  base: './',
  plugins: [react()],
});
