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
        '**/tests/**',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    // spikes/ and tests/ are throwaway PoCs or local trial workspaces with their own toolchain.
    exclude: [...configDefaults.exclude, 'spikes/**', 'tests/**'],
  },
});
