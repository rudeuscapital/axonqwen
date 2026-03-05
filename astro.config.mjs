// astro.config.mjs
import { defineConfig } from 'astro/config';
import react   from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    server: {
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/_ws': { target: 'ws://localhost:3000', ws: true },
      },
    },
  },
});
