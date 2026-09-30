// Builds the options page (React + HeroUI) and copies public/ (manifest) into dist/.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/options'),
  publicDir: resolve(import.meta.dirname, 'public'),
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500, // extension page loaded from disk; bundle size doesn't matter much
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/options/options.html'),
    },
  },
});
