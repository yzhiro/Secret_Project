// vite.config.js （修正後）

import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [
    cesium() // 既存のCesiumプラグイン設定
  ],
  server: {
    open: true, // 既存のブラウザ自動起動設定

    // ↓↓↓↓↓↓ このプロキシ設定がAPI連携に必須です ↓↓↓↓↓↓
    proxy: {
      // '/api/hotpepper' で始まるリクエストをプロキシする設定
      '/api/hotpepper': {
        target: 'http://webservice.recruit.co.jp', // 転送先のAPIサーバー
        changeOrigin: true,                         // CORSエラー回避のために必要
        rewrite: (path) => path.replace(/^\/api\/hotpepper/, '/hotpepper/gourmet/v1/'), // パスを書き換えて正しいAPIエンドポイントに転送
      },
    },
    // ↑↑↑↑↑↑ ここまでが追記部分です ↑↑↑↑↑↑
  }
});