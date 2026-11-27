import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// 読み込んでよい送り先（CSP）。2026-11-27 セキュリティの点検で追加。
// 万一、悪いスクリプトが入りこんでも、決めた送り先以外には通信できないようにする（防御を重ねる）。
// 送り先を増やしたら、ここにも足す（足さないと、その通信が止められる）。
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://eu-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'", // 画面部品の style 属性に必要
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    'https://qhaxsvljyohdohromjch.supabase.co wss://qhaxsvljyohdohromjch.supabase.co', // ログイン・同期・AIで調べる・支払い
    'https://eu.i.posthog.com https://eu-assets.i.posthog.com', // 使われ方の記録（PostHog）
    'https://ja.wikipedia.org https://en.wikipedia.org https://ja.wiktionary.org https://en.wiktionary.org', // 辞書
  ].join(' '),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** 本番用に作るときだけ、ページに CSP を入れる（開発用のサーバーは自分でスクリプトを差し込むので入れない） */
function csp(): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// base: './' で、GitHub Pages など任意のフォルダに置いても動くようにする
// 2つのページを作る：3Dのアプリ（index.html）と、Knowledge Chain の試作品（chain/index.html）
export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chain: resolve(__dirname, 'chain/index.html'),
      },
    },
  },
});
