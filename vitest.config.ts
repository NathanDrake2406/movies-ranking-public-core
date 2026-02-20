import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/db/**'],
      exclude: [
        'src/lib/types.ts',
        'src/lib/fonts.ts',
        'src/lib/scroll-intent.ts',
        'src/lib/awards/types.ts',
        'src/db/schema.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
