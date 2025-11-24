import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Allow overriding base path via environment (useful for hosting on Vercel).
  // Default to '/' for typical deployments; the previous hardcoded value
  // pointed to '/kusgan-frontend/' for GitHub Pages which breaks asset paths
  // when serving from root on other hosts.
  base: process.env.VITE_BASE || '/',
  server: {
    proxy: {
      // Proxy auth and API calls to local API server during development
      '/auth': { target: 'http://localhost:4000', changeOrigin: true },
      '/payments': { target: 'http://localhost:4000', changeOrigin: true },
      '/attendance': { target: 'http://localhost:4000', changeOrigin: true },
      '/members': { target: 'http://localhost:4000', changeOrigin: true },
      '/products': { target: 'http://localhost:4000', changeOrigin: true },
      // Proxy any /api/* requests and rewrite the path to remove the /api prefix
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/upload-photo': { target: 'http://localhost:4000', changeOrigin: true },
      '/staff': { target: 'http://localhost:4000', changeOrigin: true }
    }
  }
});
