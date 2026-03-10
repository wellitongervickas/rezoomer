import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { build as viteBuild } from 'vite';
import type { Plugin } from 'vite';

/**
 * Vite plugin that builds the service worker as a separate IIFE bundle.
 * MV3 service workers run as classic scripts — no ES module imports allowed.
 * We run a second Vite build for the service worker to guarantee a single
 * self-contained file with zero external imports.
 */
/**
 * Strips `crossorigin` attributes from HTML output.
 * Chrome extensions load resources via chrome-extension:// URLs which
 * don't support CORS — the attribute causes scripts to fail silently.
 */
function stripCrossOriginPlugin(): Plugin {
  return {
    name: 'strip-crossorigin',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'asset' && chunk.fileName.endsWith('.html')) {
          chunk.source = (chunk.source as string).replace(/ crossorigin/g, '');
        }
      }
    },
  };
}

function serviceWorkerPlugin(): Plugin {
  return {
    name: 'mv3-service-worker-iife',
    async closeBundle() {
      await viteBuild({
        configFile: false,
        resolve: {
          alias: { '@': resolve(__dirname, 'src') },
        },
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, 'src/extension/serviceWorker.ts'),
            name: 'serviceWorker',
            formats: ['iife'],
            fileName: () => 'service-worker.js',
          },
          rollupOptions: {
            output: { inlineDynamicImports: true },
          },
        },
      });
    },
    generateBundle() {
      const manifest = readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8');
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: manifest,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCrossOriginPlugin(), serviceWorkerPlugin()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  base: '',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/ui/sidepanel/index.html'),
        options: resolve(__dirname, 'src/ui/options/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
