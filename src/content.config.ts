import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** READMEs and docs extracted from proberaum/backstage-plugins by scripts/sync-plugins.mjs */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/generated/docs' }),
  schema: z.object({
    workspace: z.string(),
    kind: z.enum(['readme', 'package', 'doc']),
    package: z.string().optional(),
    slug: z.string().optional(),
    order: z.number().optional(),
    title: z.string(),
    source: z.string(),
  }),
});

export const collections = { docs };
