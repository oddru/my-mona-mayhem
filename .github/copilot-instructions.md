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
- The project is a workshop/template: many files are scaffolding and TODOs. The contributions API endpoint has been implemented as a server-side proxy that fetches https://github.com/{username}.contribs, caches results in-process, and supports an optional GitHub token.
- Deploy step expects a pre-built `_site` directory (the workflow does not run `astro build`; it assembles `_site` from `docs/` + localized workshop content).
- Minimal runtime deps: package.json contains only `astro` and `@astrojs/node`. Adding build/test tooling will require updating package.json and workflow if CI must run those tools.

## New environment variables used by the contributions proxy
- GITHUB_TOKEN — optional. If present, the proxy will send an Authorization header to the upstream to increase rate limits (recommended).
- CACHE_TTL_SECONDS — optional. Defaults to 300 (5 minutes).
- CACHE_MAX_ENTRIES — optional. Defaults to 1000.


## Notable files to inspect when working on features
- `package.json` — scripts and runtime dependencies.
- `src/pages/api/contributions/[username].ts` — TODO: implement GitHub contribution fetch.
- `src/pages/index.astro` — simple entry page for the site.
- `.github/workflows/deploy.yml` — Pages deployment flow (copies `docs/` and `workshop/` into `_site`).

## Other assistant configs scanned
No CLAUDE.md, AGENTS.md, AIDER_CONVENTIONS.md, .windsurfrules, .cursorrules, or .clinerules were found.

---

## Design guide — Retro arcade theme (short)
- Palette: dark background #0a0a1a; neon green #5fed83; neon purple #8a2be2; muted text #9aa0a6; light accents #e6f7ea.
- Font: Press Start 2P for headings; system UI (Inter/Segoe/Roboto) for body text.
- Animation: prefer CSS-only animations using transform & opacity; timings: micro ~120ms, medium ~260ms, slow ~800ms. Respect prefers-reduced-motion.
- UI rules: new UI components should preserve the neon aesthetic — neon glows, subtle CRT scanlines, and soft color-shifting accents. Keep high contrast and accessible focus states.

If you want this file adjusted (more detail about the API, recommended test/lint tooling, or automatic CI test steps), say which area to expand.
