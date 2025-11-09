import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.config';

const chromeExtensionRoot = path.resolve(__dirname, '../extension');

export default defineConfig({
  root: chromeExtensionRoot,
  publicDir: path.resolve(chromeExtensionRoot, 'public'),
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(chromeExtensionRoot, 'src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    manifest: false
  },
  css: {
    postcss: path.resolve(__dirname, '../extension/postcss.config.cjs')
  }
});
