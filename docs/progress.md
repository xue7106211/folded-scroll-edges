# Progress

## 2026-11-08 — PR #1 merged: iOS overscroll + `/compare`

- Merged: iOS-style hyperbolic overscroll on the cylinder scroller; `/compare` auto-demo; unit tests; Pages worker route for `/compare`.
- Artifacts from that work (Playwright 390×844) lived under `/opt/cursor/artifacts/` on the agent run.
- Site remained multi-page Vite (`index.html`, `compare.html`).

## 2026-11-08 — Cloudflare Git deploy failure (Workers Builds)

- User connected Cloudflare Git automatic deployment.
- Observed environment: Node 24.22.1, npm 10.9.2; `npm clean-install` OK; `npm run build` OK; `dist/index.html` + `dist/compare.html` present.
- Deploy path used `npx wrangler deploy` (Wrangler **4.158.0**, not previously a dependency).
- CI automatic setup tried to install `@cloudflare/vite-plugin` and invent `wrangler.jsonc` (SPA assets), then failed modifying `vite.config` (`plugins` array missing).
- Diagnosis: **Workers Builds / Workers static assets**, not Pages direct-upload.

## 2026-11-08 — Fix (this branch): deterministic Workers static config

- Add `wrangler.jsonc` assets-only config → `./dist`, no SPA fallback.
- Add `public/_redirects` for `/compare/` → `/compare`.
- Pin `wrangler@4.158.0`; scripts `deploy`, `deploy:dry-run`, `verify:deploy-local`.
- Preserve `pack:worker` Pages path.
- Document Workers vs Pages commands in README + `docs/decisions.md`.
- Local acceptance (this run):
  - `npm ci` OK
  - `npm test` → 12 passed
  - `npm run build` → `dist/index.html` + `dist/compare.html` + `dist/_redirects`
  - `npm run deploy:dry-run` → wrangler 4.158.0, no interactive scaffold, no source mutation
  - `npm run verify:deploy-local` → `/` 200 home; `/compare` 200 compare; `/compare/` 308 → `/compare`; unknown 404 (no homepage SPA fallback); screenshots under `/opt/cursor/artifacts/deploy_local_*.png`
- **Still missing:** real remote Workers Builds / production deploy verification (intentionally not run; no credentials required for this fix).
