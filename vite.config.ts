/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// إعداد Vite — تطبيق محلي بالكامل بلا أي مورد خارجي.
// PWA: يعمل بلا إنترنت ويُثبَّت على سطح المكتب كأي برنامج (§ الأمر ٩).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "fonts/*.woff2", "icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "منصّة أبلة عفاف",
        short_name: "أبلة عفاف",
        description: "منصّة معلّمة العلوم — تعمل بلا إنترنت، بياناتك على جهازك فقط.",
        lang: "ar",
        dir: "rtl",
        theme_color: "#8A1538",
        background_color: "#FAF6EE",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // خزّن كل الأصول محلياً — يعمل التطبيق كاملاً بلا إنترنت.
        // الحد مرفوع ليشمل مكتبة الرؤية (OpenCV ~15م.ب) لقراءة الدرجات بالتصوير بلا نت (§2-ب).
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico}"],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
