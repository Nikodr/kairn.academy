// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://kairn.academy',
  integrations: [
    sitemap({
      // Studio is a partners-only page (noindex) — keep it out of the sitemap.
      // The OPCO simulator and its privacy page stay unlisted until lead capture is wired up.
      filter: (page) => !['/studio', '/simulateur-opco', '/confidentialite'].some((p) => page.includes(p)),
    }),
  ],
});
