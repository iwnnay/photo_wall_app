import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    env: {
      // Force the runtime singleton in $lib/server/db.ts onto an in-memory DB
      // when any test happens to import it.
      PHOTO_WALL_DB: ':memory:'
    }
  }
});
