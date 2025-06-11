import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [
    cesium()        // Cesium のアセットを dist に自動コピー
  ],
  server: { open: true }          // 起動時にブラウザを開く
});
