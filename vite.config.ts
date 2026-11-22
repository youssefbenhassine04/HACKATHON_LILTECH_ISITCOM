import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// When the API runs with HTTPS_ENABLED=true, the dev proxy must follow it.
const useHttps = process.env.HTTPS_ENABLED === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `${useHttps ? 'https' : 'http'}://localhost:3001`,
        changeOrigin: true,
        // Local dev certificates are self-signed.
        secure: false,
      },
    },
  },
});
