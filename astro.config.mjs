// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://kairn.academy',
  integrations: [
    sitemap({
      // Studio is a partners-only page (noindex) — keep it out of the sitemap.
      filter: (page) => !page.includes('/studio'),
    }),
  ],
});
