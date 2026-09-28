import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaDesign } from './src/design/vite-plugin';

export default defineConfig({
  plugins: [react(), vanillaDesign()],
  server: { host: '127.0.0.1', port: 5207, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
