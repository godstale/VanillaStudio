import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The host dev server shares this package's node_modules; separate caches stop them invalidating each other.
  cacheDir: '../node_modules/.vite-preview',
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
});
