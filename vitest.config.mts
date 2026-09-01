/* The `@/…` alias is declared in `tsconfig.json` for Next and the editor, but
   Vitest resolves modules itself and does not read it. Without this, any test
   that reaches a file importing `@/lib/…` fails to load — which is most of
   `lib/importers/`. */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
