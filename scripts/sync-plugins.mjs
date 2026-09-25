#!/usr/bin/env node
/**
 * Extracts plugin metadata, READMEs, docs and screenshots from a checkout of
 * https://github.com/proberaum/backstage-plugins and writes them into the
 * Astro project:
 *
 *   src/generated/plugins.json      – workspace + package metadata
 *   src/generated/docs/**.md        – READMEs and docs (content collection)
 *   public/plugin-assets/**         – screenshots and other images
 *
 * The checkout location can be set with BACKSTAGE_PLUGINS_DIR. When the
 * directory does not exist, the repository is cloned (shallow) into it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_URL =
  process.env.BACKSTAGE_PLUGINS_REPO ?? 'https://github.com/proberaum/backstage-plugins';
const SOURCE = path.resolve(
  ROOT,
  process.env.BACKSTAGE_PLUGINS_DIR ?? '.cache/backstage-plugins',
);
const OUT_DATA = path.join(ROOT, 'src/generated');
const OUT_DOCS = path.join(OUT_DATA, 'docs');
const OUT_ASSETS = path.join(ROOT, 'public/plugin-assets');
const ASSETS_URL = '/plugin-assets';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dist-types']);
const IGNORED_WORKSPACES = new Set(['noop']);
const SCAFFOLD_MARKER = 'This is your newly scaffolded Backstage App';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function ensureSource() {
  if (fs.existsSync(path.join(SOURCE, 'workspaces'))) return;
  console.log(`Cloning ${REPO_URL} into ${path.relative(ROOT, SOURCE)} …`);
  fs.mkdirSync(path.dirname(SOURCE), { recursive: true });
  git('clone', '--depth', '1', REPO_URL, SOURCE);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

/** Recursively find images inside a workspace, skipping build output and the example app. */
function findImages(dir, depth = 0) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      // The example Backstage app lives in <workspace>/packages.
      if (depth === 0 && entry.name === 'packages') continue;
      result.push(...findImages(full, depth + 1));
    } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      result.push(full);
    }
  }
  return result.sort();
}

const repoRel = file => path.relative(SOURCE, file).split(path.sep).join('/');

function copyAsset(file) {
  const rel = repoRel(file);
  const target = path.join(OUT_ASSETS, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
  return `${ASSETS_URL}/${rel}`;
}

function titleFromFile(file) {
  const base = path.basename(file, path.extname(file)).replace(/[-_]+/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Split off the first H1 so pages can render their own heading, and return
 * the remaining markdown.
 */
function splitTitle(markdown) {
  const match = markdown.match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  if (!match || markdown.slice(0, match.index).trim() !== '') {
    return { title: undefined, body: markdown };
  }
  return {
    title: match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim(),
    body: markdown.slice(match.index + match[0].length).replace(/^\s*\n/, ''),
  };
}

/**
 * Rewrites relative links and images in markdown so they work on the website:
 * images are copied to public/, links to synced docs point to site routes and
 * everything else points to GitHub.
 */
function rewriteLinks(markdown, mdFile, ctx) {
  const dir = path.dirname(mdFile);

  const resolve = (url, isImage) => {
    if (!url || /^([a-z]+:|#|\/\/)/i.test(url)) return url;
    const [pathname, hash = ''] = url.split('#');
    const abs = pathname.startsWith('/')
      ? path.join(SOURCE, pathname)
      : path.resolve(dir, decodeURIComponent(pathname));
    if (!abs.startsWith(SOURCE)) return url;

    if (isImage || IMAGE_EXT.has(path.extname(abs).toLowerCase())) {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return copyAsset(abs);
    }
    const route = ctx.routes.get(abs) ?? ctx.routes.get(`${abs}.md`);
    if (route) return hash ? `${route}#${hash}` : route;

    const kind = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? 'tree' : 'blob';
    return `${ctx.githubUrl}/${kind}/${ctx.branch}/${repoRel(abs)}${hash ? `#${hash}` : ''}`;
  };

  // Skip fenced code blocks so snippets stay untouched.
  return markdown
    .split(/(^```[\s\S]*?^```|^~~~[\s\S]*?^~~~)/m)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(\s+"[^"]*")?\s*\)/g, (_m, bang, text, url, title = '') =>
          `${bang}[${text}](${resolve(url, bang === '!')}${title})`,
        )
        .replace(/(<img\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, (_m, pre, q, url) => `${pre}${q}${resolve(url, true)}${q}`)
        .replace(/(<a\b[^>]*?\bhref=)(["'])([^"']+)\2/gi, (_m, pre, q, url) => `${pre}${q}${resolve(url, false)}${q}`);
    })
    .join('');
}

function frontmatter(data) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

function writeDoc(relPath, data, body) {
  const target = path.join(OUT_DOCS, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, frontmatter(data) + body.trimEnd() + '\n');
}

function main() {
  ensureSource();

  let branch = 'main';
  let commit;
  try {
    branch = git('-C', SOURCE, 'rev-parse', '--abbrev-ref', 'HEAD') || 'main';
    if (branch === 'HEAD') branch = 'main';
    commit = git('-C', SOURCE, 'rev-parse', 'HEAD');
  } catch {
    // Not a git checkout (e.g. a downloaded archive) – fall back to defaults.
  }
  const githubUrl = REPO_URL.replace(/\.git$/, '');

  fs.rmSync(OUT_DOCS, { recursive: true, force: true });
  fs.rmSync(OUT_ASSETS, { recursive: true, force: true });
  fs.mkdirSync(OUT_DOCS, { recursive: true });
  fs.mkdirSync(OUT_ASSETS, { recursive: true });

  const workspacesDir = path.join(SOURCE, 'workspaces');
  const workspaces = [];
  const routes = new Map();
  const pendingDocs = [];

  // First pass: collect metadata and site routes for every markdown file.
  for (const id of listDirs(workspacesDir)) {
    if (IGNORED_WORKSPACES.has(id)) continue;
    const wsDir = path.join(workspacesDir, id);
    const wsRoute = `/plugins/${id}/`;

    const packages = [];
    for (const pkgDir of listDirs(path.join(wsDir, 'plugins'))) {
      const dir = path.join(wsDir, 'plugins', pkgDir);
      const pkgFile = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgFile)) continue;
      const pkg = readJson(pkgFile);
      const readme = path.join(dir, 'README.md');
      packages.push({
        dir: pkgDir,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        role: pkg.backstage?.role,
        pluginId: pkg.backstage?.pluginId,
        private: Boolean(pkg.private),
        published: !pkg.private && pkg.version !== '0.0.0',
        path: repoRel(dir),
        hasReadme: fs.existsSync(readme),
      });
      if (fs.existsSync(readme)) {
        routes.set(readme, `${wsRoute}#pkg-${pkgDir}`);
        pendingDocs.push({ file: readme, out: `${id}/packages/${pkgDir}.md`, data: { workspace: id, kind: 'package', package: pkgDir } });
      }
    }
    // Workspaces without any plugin package are just placeholders.
    if (packages.length === 0) continue;

    const readme = path.join(wsDir, 'README.md');
    let hasReadme = false;
    if (fs.existsSync(readme)) {
      const scaffold = fs.readFileSync(readme, 'utf8').includes(SCAFFOLD_MARKER);
      if (!scaffold) {
        hasReadme = true;
        routes.set(readme, wsRoute);
        pendingDocs.push({ file: readme, out: `${id}/readme.md`, data: { workspace: id, kind: 'readme' } });
      }
    }

    const docs = [];
    const docsDir = path.join(wsDir, 'docs');
    if (fs.existsSync(docsDir)) {
      const files = fs
        .readdirSync(docsDir)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => (a === 'index.md' ? -1 : b === 'index.md' ? 1 : a.localeCompare(b)));
      files.forEach((f, order) => {
        const slug = path.basename(f, '.md');
        const file = path.join(docsDir, f);
        routes.set(file, `${wsRoute}docs/${slug}/`);
        pendingDocs.push({ file, out: `${id}/docs/${slug}.md`, data: { workspace: id, kind: 'doc', slug, order } });
        docs.push(slug);
      });
    }

    const screenshots = findImages(wsDir).map(file => ({
      src: copyAsset(file),
      path: repoRel(file),
      alt: `${titleFromFile(file)} (${path.basename(path.dirname(file))})`,
    }));

    workspaces.push({ id, path: repoRel(wsDir), hasReadme, docs, packages, screenshots });
  }

  // Second pass: write markdown with rewritten links.
  const ctx = { routes, githubUrl, branch };
  for (const doc of pendingDocs) {
    const raw = fs.readFileSync(doc.file, 'utf8');
    const { title, body } = splitTitle(raw);
    writeDoc(
      doc.out,
      {
        ...doc.data,
        title: title ?? titleFromFile(doc.file),
        source: repoRel(doc.file),
      },
      rewriteLinks(body, doc.file, ctx),
    );
  }

  const data = {
    repository: githubUrl,
    branch,
    commit,
    syncedAt: new Date().toISOString(),
    workspaces,
  };
  fs.writeFileSync(path.join(OUT_DATA, 'plugins.json'), JSON.stringify(data, null, 2) + '\n');

  console.log(
    `Synced ${workspaces.length} workspaces, ${pendingDocs.length} markdown files` +
      (commit ? ` from ${commit.slice(0, 7)}` : ''),
  );
}

main();
