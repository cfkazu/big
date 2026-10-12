import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// `vite build --mode artifact` では同梱フォントを外し、1 枚の HTML にまとめやすい形で出力する
export default defineConfig(({ mode }) => ({
  resolve: mode === 'artifact' ? { alias: { '@fontsource/dotgothic16': fileURLToPath(new URL('./src/stub/empty.ts', import.meta.url)) } } : {},
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100000000, cssCodeSplit: false, modulePreload: false } : {},
}));
