import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

const rootDir = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src')
    }
  },
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name].js'
      }
    }
  }
});
