/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/idle-matcha-mine/' : '/', // GitHub Pages: pboaa.github.io/idle-matcha-mine/
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/application/**', 'src/shared/**'],
    },
  },
}));
