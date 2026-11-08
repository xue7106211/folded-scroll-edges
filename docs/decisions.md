# Decisions

## D1 — Cylinder WebGL scroll (merged, PR #1 era)

- **Choice:** Full-screen horizontal-axis cylinder in hand-written WebGL2; atlas texture from 《百年孤独》 passages + procedural thumbs.
- **Why:** Zero runtime deps; matches the product demo; keeps rendering isolated from scroll physics.
- **Consequence:** Scroll drives UV / CSS translate only; do not change shaders/geometry when iterating interaction.

## D2 — iOS rubber-band overscroll (merged via PR #1)

- **Choice:** Pure function `rubberBandOffset` using UIScrollView form  
  `offset = (1 - 1 / (c * x / d + 1)) * d` with `c = 0.55`.
- **Why:** Requirement text wrote `x / (c * d)`, which *amplifies* small pulls at `c = 0.55`. Captions and the reference video require resistance (`c * x / d`).
- **Consequence:** Unit tests lock the resisting form; `/compare` shows Most apps (`offset = x`) vs iPhone (damped).

## D3 — `/compare` as a second HTML entry (merged via PR #1)

- **Choice:** Vite multi-page build (`index.html` + `compare.html`), not client-side SPA routing.
- **Why:** Cloudflare Pages direct-upload worker and static hosts need a real `compare.html` asset; homepage must stay unchanged.
- **Consequence:** Deploy routing must map `/compare` and `/compare/` to the compare document and must **not** use SPA `not_found_handling` that serves `index.html` for unknown paths.

## D4 — Workers Git deploy: explicit static assets, no Vite plugin (this change)

- **Context:** After PR #1 merged, Cloudflare Git auto-deploy ran **Workers Builds**. Log showed Wrangler detecting Vite, then CI automatic setup installing `wrangler` + `@cloudflare/vite-plugin` and trying to create `wrangler.jsonc` with SPA `not_found_handling`. It failed with:  
  `Cannot modify Vite config: could not find a valid plugins array.`
- **Root cause:** No checked-in Wrangler config → Workers/Wrangler attempted framework scaffolding against a Vite config that only sets `build.rollupOptions.input` (no `plugins` array). This is Workers static-asset deploy, not Pages.
- **Choice:**
  1. Commit deterministic `wrangler.jsonc` with `assets.directory = "./dist"`, `html_handling = "auto-trailing-slash"`, `not_found_handling = "none"`.
  2. Do **not** add `@cloudflare/vite-plugin` or mutate `vite.config.ts` for Cloudflare.
  3. Pin `wrangler@4.158.0` in `devDependencies` (matches the version CI pulled) and keep lockfile in sync.
  4. Keep `npm run pack:worker` for Pages direct-upload unchanged.
- **Why:** Minimal, non-interactive, multi-page-safe. Explicit config stops scaffolding; avoiding the Vite plugin keeps build = plain `vite build`.
- **Consequence:** Workers Builds should use `npm run build` then `npx wrangler deploy` / `npm run deploy`. Local `deploy:dry-run` and `verify:deploy-local` validate packaging and `/` + `/compare` (+ `/compare/`) without credentials.
