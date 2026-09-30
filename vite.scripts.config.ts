// Builds the content script and background worker as single self-contained files
// (content scripts can't be ES modules). Run with --mode content | background.
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, `src/${mode}/index.ts`),
      formats: ['iife'],
      name: `inlineChatGPT_${mode}`,
      fileName: () => `${mode}.js`,
    },
  },
}));
