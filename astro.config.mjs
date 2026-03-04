// astro.config.mjs
import { defineConfig } from 'astro/config';
import node    from '@astrojs/node';
import react   from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',            // SSR — all pages rendered on the server
  adapter: node({
    mode: 'standalone',        // Outputs a self-contained Node.js server
  }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  server: {
    port: 4321,
    host:  true,
  },
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});
