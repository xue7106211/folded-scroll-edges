# AGENTS.md

Vite + plain TypeScript + hand-written WebGL2. No framework and no runtime dependencies; keep it that way.

## Commands

- `npm run dev`: Vite on http://localhost:5173 (it switches ports if 5173 is taken; trust the log).
- `npm run build`: `tsc --noEmit && vite build`. There is no lint or test setup, so this is the only check. `npx tsc --noEmit` on its own type-checks faster.
- `npm run pack:worker`: run it after `build`. It reads `dist/` and writes `pages-worker.js` and `pages-worker-meta.json` to the **repo root** (both are gitignored). The README says `_worker.js`; that name comes from the Cloudflare Pages deploy step, which this script does not perform.
- `scripts/shots.mjs` imports Playwright from a hard-coded `/workspace/pw-tools/...` path and does not run on this machine. On Windows, take screenshots with headless Edge instead, e.g. `msedge --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=842,1246 --virtual-time-budget=4000 --screenshot=out.png http://localhost:5173/`.

## How rendering is wired

- `src/main.ts`: input (wheel and drag, inertia, clamped to `feed.maxScroll()`), the theme switch (`html[data-bg]` with `dark` / `light` / `color`, saved in `localStorage['cyl-bg']`), and the rAF loop. Each frame it calls `feed.update(now, scroll)` and calls `renderer.upload()` only when that returns true.
- `src/feed.ts`: draws the whole notification list on an offscreen 2D canvas, including scrolling (via `ctx.setTransform`) and the spring animations (stiffness 350, damping 40, matching Magic UI Animated List). Content, copy (`NOTICES`, Chinese, design-collaboration theme) and icons (`ICONS`, Phosphor duotone SVG paths, MIT, credit kept in comments and README) all live here.
- `src/cylinder.ts`: bends that canvas texture over a horizontal-axis cylinder. The shader only samples the texture. It does not scroll.

## Gotchas

- Layout units in `feed.ts` are "content px". `renderer.resize()` returns the cylinder front's on-screen CSS width, and `feed.resize()` sets things up so that 1 content px is 1 screen CSS px and texture pixels match device pixels 1:1. Do not hard-code canvas or texture sizes, and do not adjust font sizes by eye at a single window size: the projection grows with viewport **height**.
- `resize` must run before the first `draw`/`upload`. The texture is (re)allocated with `texImage2D` when its size changes and updated with `texSubImage2D` otherwise. Call `generateMipmap` after every upload.
- Alpha is premultiplied end to end: `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, the shader outputs `t * a`, and blending is `ONE, ONE_MINUS_SRC_ALPHA`. Changing any one of the three causes dark or light card fringes.
- Canvas `shadowBlur`/`shadowOffset` ignore the transform, so multiply them by the scale manually (`shadowK`).
- The theme is read from `document.documentElement.dataset.bg` inside `feed.update()`. A new theme has to be added to both CSS and the card paint code.
- `main.ts` waits for the Google Fonts `Noto Sans SC` before drawing, because canvas text locks in whatever font is loaded. That request often fails on Chinese networks, and the console error is expected. The font stack is PingFang → Noto Sans SC → Microsoft YaHei.
- Typography is tuned for Chinese UI (14 / 12 / 11 px, 4px grid, hierarchy carried by opacity). The user prefers refined, smaller type and minimal English in the UI.
- When copying SVG path data, compare it against upstream (`phosphor-icons/core/main/assets/duotone/*.svg`) programmatically. Hand copying has introduced typos before.

## Conventions

- Reply to the user and write code comments in Chinese (user steering in `~/.kiro/steering/chinese-reply.md`). Comments are sparse and explain the reason behind the code.
- Files use CRLF line endings.
