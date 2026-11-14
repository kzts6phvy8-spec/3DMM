import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// base: './' で、GitHub Pages など任意のフォルダに置いても動くようにする
// 2つのページを作る：3Dのアプリ（index.html）と、Knowledge Chain の試作品（chain/index.html）
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chain: resolve(__dirname, 'chain/index.html'),
      },
    },
  },
});
