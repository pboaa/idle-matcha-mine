/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/idle-matcha-mine/' : '/', // GitHub Pages: pboaa.github.io/idle-matcha-mine/
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version), // バージョンは固定（package.json を上げた時だけ変わる）
  },
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
