import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // manifest.json を dist にコピー
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );

        // ONNX Runtime WASM ファイルを dist/wasm/ にコピー（CSP 対策）
        const wasmSrc = resolve(__dirname, 'node_modules/onnxruntime-web/dist');
        const wasmDest = resolve(__dirname, 'dist/wasm');
        mkdirSync(wasmDest, { recursive: true });
        for (const file of readdirSync(wasmSrc)) {
          if (file.endsWith('.wasm') || file.endsWith('.mjs') || file.endsWith('.js')) {
            copyFileSync(resolve(wasmSrc, file), resolve(wasmDest, file));
          }
        }
      },
    },
  ],
  worker: {
    format: 'es',
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 10000, // Transformers.js は大きいため警告リミットを引き上げ
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        debug: resolve(__dirname, 'src/debug/debug.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
