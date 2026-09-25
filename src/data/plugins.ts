import synced from '../generated/plugins.json';

export type Status = 'stable' | 'complete' | 'preview' | 'in-progress' | 'experimental';

interface Meta {
  title: string;
  emoji: string;
  description: string;
  status: Status;
  statusNote?: string;
}

/**
 * Curated metadata per workspace. Everything else (packages, READMEs, docs,
 * screenshots) comes from the synced proberaum/backstage-plugins checkout.
 * Workspaces without an entry here still show up, with generated defaults.
 */
const META: Record<string, Meta> = {
  'github-notifications': {
    title: 'GitHub Notifications',
    emoji: '📬',
    description:
      'Automated Backstage notifications for new and updated GitHub issues related to catalog entities, configured via entity annotations.',
    status: 'stable',
    statusNote: 'Production ready',
  },
  'config-viewer': {
    title: 'Config viewer',
    emoji: '⚙️',
    description: 'Lets admins read the (full) frontend and, optionally, the backend configuration of their Backstage instance.',
    status: 'complete',
    statusNote: 'Feature complete, permission support might follow',
  },
  'env-viewer': {
    title: 'Env viewer',
    emoji: '💻',
    description: 'Lets admins and users view the server-side environment variables of the Backstage backend.',
    status: 'complete',
    statusNote: 'Feature complete, permission support might follow',
  },
  'icon-viewer': {
    title: 'Icon viewer',
    emoji: '🖼️',
    description: 'Shows all icons that are available in the app, including the ones registered by frontend plugins at runtime.',
    status: 'complete',
    statusNote: 'Feature complete',
  },
  'analytics-viewer': {
    title: 'Analytics → Browser Log',
    emoji: '🔎',
    description:
      'An Analytics API implementation that sends all events to the browser console – for developers who like to debug analytics events.',
    status: 'complete',
    statusNote: 'Feature complete, mostly for plugin development',
  },
  assets: {
    title: 'Assets Catalog',
    emoji: '📚',
    description:
      'An asset / inventory plugin that stores physical items and their locations in the catalog – from personal belongings up to a data center.',
    status: 'preview',
    statusNote: 'Preview, contains just a catalog provider yet',
  },
  dashboards: {
    title: 'Dashboards',
    emoji: '📊',
    description: 'Create and share dashboards inside Backstage.',
    status: 'in-progress',
    statusNote: 'In progress',
  },
  'planning-poker': {
    title: 'Planning Poker',
    emoji: '🃏',
    description: 'A small plugin to estimate stories together with Planning Poker.',
    status: 'in-progress',
    statusNote: 'In progress',
  },
  'scheduler-notifications': {
    title: 'Scheduler Notifications',
    emoji: '⏰',
    description: 'Send recurring notifications (cron or interval based) to users and groups, defined as entities in the catalog.',
    status: 'experimental',
    statusNote: 'Early stage',
  },
  hcloud: {
    title: 'Hetzner Cloud',
    emoji: '☁️',
    description: 'Shows Hetzner Cloud server status on catalog entity pages and optionally imports servers as Resource entities.',
    status: 'experimental',
    statusNote: 'Early stage',
  },
};

export const STATUS_LABEL: Record<Status, string> = {
  stable: 'Stable',
  complete: 'Feature complete',
  preview: 'Preview',
  'in-progress': 'In progress',
  experimental: 'Experimental',
};

const STATUS_ORDER: Status[] = ['stable', 'complete', 'preview', 'in-progress', 'experimental'];

export type SyncedWorkspace = (typeof synced.workspaces)[number];
export type Package = SyncedWorkspace['packages'][number];
export type Plugin = SyncedWorkspace & Meta;

function humanize(id: string) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const repository = {
  url: synced.repository,
  branch: synced.branch,
  commit: synced.commit as string | undefined,
  syncedAt: synced.syncedAt,
};

export const plugins: Plugin[] = synced.workspaces
  .map(ws => ({
    ...ws,
    ...(META[ws.id] ?? {
      title: humanize(ws.id),
      emoji: '🧩',
      description:
        ws.packages.find(p => p.description)?.description ?? `Backstage plugin packages of the ${ws.id} workspace.`,
      status: 'experimental' as const,
    }),
  }))
  .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.title.localeCompare(b.title));

export function githubUrl(path: string, kind: 'tree' | 'blob' = 'tree') {
  return `${repository.url}/${kind}/${repository.branch}/${path}`;
}

export function npmUrl(name: string) {
  return `https://www.npmjs.com/package/${name}`;
}

export const ROLE_LABEL: Record<string, string> = {
  'frontend-plugin': 'Frontend plugin',
  'frontend-plugin-module': 'Frontend module',
  'backend-plugin': 'Backend plugin',
  'backend-plugin-module': 'Backend module',
  'common-library': 'Common library',
  'web-library': 'Web library',
  'node-library': 'Node library',
};

/** Generates install instructions based on the Backstage package role. */
export function installSnippet(pkg: Package): { lang: string; title: string; code: string }[] {
  switch (pkg.role) {
    case 'backend-plugin':
    case 'backend-plugin-module':
      return [
        {
          lang: 'sh',
          title: 'Terminal',
          code: `# From your Backstage root directory\nyarn --cwd packages/backend add ${pkg.name}`,
        },
        {
          lang: 'ts',
          title: 'packages/backend/src/index.ts',
          code: `const backend = createBackend();\n// ...\nbackend.add(import('${pkg.name}'));`,
        },
      ];
    case 'frontend-plugin':
    case 'frontend-plugin-module':
      return [
        {
          lang: 'sh',
          title: 'Terminal',
          code: `# From your Backstage root directory\nyarn --cwd packages/app add ${pkg.name}`,
        },
      ];
    default:
      return [
        {
          lang: 'sh',
          title: 'Terminal',
          code: `yarn add ${pkg.name}`,
        },
      ];
  }
}
