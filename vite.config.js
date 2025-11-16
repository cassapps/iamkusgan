import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/kusgan-frontend/", // dev and build base path
  server: {
    proxy: {
      // Proxy auth and API calls to local API server during development
      '/auth': 'http://localhost:4000',
      '/payments': 'http://localhost:4000',
      '/attendance': 'http://localhost:4000',
      '/members': 'http://localhost:4000',
      '/products': 'http://localhost:4000',
      // Proxy any /api/* requests and the upload endpoint to the API server
      '/api': 'http://localhost:4000',
      '/upload-photo': 'http://localhost:4000',
      '/staff': 'http://localhost:4000'
    }
  }
});
