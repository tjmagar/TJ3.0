import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "TJ 3.0",
        short_name: "TJ 3.0",
        description: "A personal journal and operating system.",
        display: "standalone",
        theme_color: "#F5F2EA",
        background_color: "#F5F2EA",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Hashed build assets (JS/CSS) are content-addressed, safe to cache-first.
        // The navigation request itself (index.html) is NOT precached here —
        // navigateFallback below is served network-first via the runtimeCaching
        // entry so a Vercel redeploy is picked up on next load instead of being
        // pinned behind a stale service worker.
        globPatterns: ["**/*.{js,css,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "tj3-shell", networkTimeoutSeconds: 3 },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
  },
  test: {
    environment: "node",
    globals: false,
  },
});
