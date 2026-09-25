# proberaum.github.io

Website for [proberaum/backstage-plugins](https://github.com/proberaum/backstage-plugins), built with [Astro](https://astro.build) and published to GitHub Pages at <https://proberaum.github.io>.

Each plugin (a workspace in the plugins repository) gets its own page with screenshots, its README, generated install instructions and, where available, additional docs from `workspaces/<name>/docs/*.md`.

## How it works

1. `scripts/sync-plugins.mjs` reads a checkout of `proberaum/backstage-plugins` (cloned automatically into `.cache/backstage-plugins` if missing) and extracts:
   - package metadata from `workspaces/*/plugins/*/package.json` → `src/generated/plugins.json`
   - READMEs and docs → `src/generated/docs/**` (an Astro content collection)
   - screenshots and images → `public/plugin-assets/**`

   Relative links are rewritten: images point to the copied files, links to synced docs point to site pages and everything else points to GitHub.
2. Astro renders the pages. Code blocks are rendered with [Expressive Code](https://expressive-code.com) (syntax highlighting, titles, copy button, light/dark themes – see `ec.config.mjs`).
3. `.github/workflows/deploy.yml` checks out both repositories, builds the site and deploys it to GitHub Pages on every push to `main`, daily, manually, or when the plugins repo sends a `backstage-plugins-updated` `repository_dispatch` event.

Curated titles, emojis, descriptions and status labels live in `src/data/plugins.ts`. New workspaces with plugin packages show up automatically with generated defaults.

## Development

```sh
npm install
npm run dev      # sync + dev server on http://localhost:4321
npm run build    # sync + static build into dist/
npm run sync     # only re-extract docs
```

Set `BACKSTAGE_PLUGINS_DIR` to use an existing local checkout of the plugins repository.

## Setup

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

To redeploy whenever the plugins repository changes, add a step like this to a workflow there (with a token that can dispatch events to this repository):

```yaml
- run: gh api repos/proberaum/proberaum.github.io/dispatches -f event_type=backstage-plugins-updated
  env:
    GH_TOKEN: ${{ secrets.PAGES_DISPATCH_TOKEN }}
```
