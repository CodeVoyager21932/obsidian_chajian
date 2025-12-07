import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],
  },
  resolve: {
    alias: {
      obsidian: new URL('./test-mocks/obsidian.ts', import.meta.url).pathname,
    },
  },
});
