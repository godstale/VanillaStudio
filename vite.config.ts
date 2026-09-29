import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 14200,
    strictPort: true,
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/.vanilla/**',
        '**/*.db',
        '**/*.db-*',
        '**/*.sqlite*',
        '**/logs/**',
        '**/spikes/**',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    // spikes/ are throwaway PoCs with their own toolchain and cwd-relative fixtures.
    exclude: [...configDefaults.exclude, 'spikes/**'],
  },
});
