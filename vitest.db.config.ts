import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Integration tests against the local Supabase stack (`npx supabase start`). Run with `npm run test:db`. */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
