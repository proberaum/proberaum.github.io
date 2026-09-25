// @ts-check
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://proberaum.github.io',
  // Options live in ec.config.mjs so the <Code> component can use them too.
  integrations: [expressiveCode()],
});
