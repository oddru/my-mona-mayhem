# Copilot instructions for this repository

This file helps future Copilot CLI/agents work effectively in this repo.

## Build, test, and lint commands
- Development server: `npm run dev`  (runs `astro dev`).
- Production build: `npm run build` (runs `astro build`).
- Preview built site: `npm run preview` (runs `astro preview`).
- Helper CLI: `npm run astro` (runs `astro`).

Notes: There is no `test` or `lint` script in package.json at present. If tests are added, follow the project's test-runner docs to run a single test (e.g., the chosen runner's CLI supports single-test patterns or `-t/--testNamePattern`).

## High-level architecture (big picture)
- Framework: Astro v5 site using `@astrojs/node` adapter. The app is a static-first workshop site with a small server-side API surface.
- Source layout:
  - `src/pages/` — Astro pages and API routes. Dynamic API endpoints live under `src/pages/api/*` (e.g., `src/pages/api/contributions/[username].ts`).
  - `docs/` and `workshop/` — source content that the GitHub Actions workflow copies into `_site` for Pages deployment.
  - Build output: `_site/` (GitHub Actions expects the deployable site here).
- CI/CD: `.github/workflows/deploy.yml` builds the site by copying `docs/*` and localized `workshop/*` into `_site`, uploads the artifact, and deploys to GitHub Pages.

## Key conventions and repository-specific patterns
- Language/localization variants: workshop content is kept per-language (e.g., `workshop/pt_BR/`, `workshop/es/`). The deploy workflow explicitly copies these localized folders into `_site`.
- API pages use Astro's server runtime: dynamic API files typically set `export const prerender = false;`—treat them as server-handled routes (not static).
- The project is a workshop/template: many files are scaffolding and TODOs — e.g., the contributions API endpoint currently responds with 501 and should be implemented when adding functionality.
- Deploy step expects a pre-built `_site` directory (the workflow does not run `astro build`; it assembles `_site` from `docs/` + localized workshop content).
- Minimal runtime deps: package.json contains only `astro` and `@astrojs/node`. Adding build/test tooling will require updating package.json and workflow if CI must run those tools.

## Notable files to inspect when working on features
- `package.json` — scripts and runtime dependencies.
- `src/pages/api/contributions/[username].ts` — TODO: implement GitHub contribution fetch.
- `src/pages/index.astro` — simple entry page for the site.
- `.github/workflows/deploy.yml` — Pages deployment flow (copies `docs/` and `workshop/` into `_site`).

## Other assistant configs scanned
No CLAUDE.md, AGENTS.md, AIDER_CONVENTIONS.md, .windsurfrules, .cursorrules, or .clinerules were found.

---

If you want this file adjusted (more detail about the API, recommended test/lint tooling, or automatic CI test steps), say which area to expand.
