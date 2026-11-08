# AGENTS.md

Vite + plain TypeScript + hand-written WebGL2. No framework and no runtime dependencies; keep it that way.

## Commands

- `npm run dev`: Vite on http://localhost:5173 (it switches ports if 5173 is taken; trust the log).
- `npm run build`: `tsc --noEmit && vite build`. `npm run build:lib` builds the component (Vite library mode + `tsc -p tsconfig.lib.json` for `.d.ts`). There is no lint or test setup, so these are the only checks. `npx tsc --noEmit` on its own type-checks faster.
- `npm run pack:worker`: run it after `build`. It reads `dist/` and writes `pages-worker.js` and `pages-worker-meta.json` to the **repo root** (both are gitignored). The README says `_worker.js`; that name comes from the Cloudflare Pages deploy step, which this script does not perform.
- `scripts/shots.mjs` imports Playwright from a hard-coded `/workspace/pw-tools/...` path and does not run on this machine. On Windows, take screenshots with headless Edge instead, e.g. `msedge --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=842,1246 --virtual-time-budget=4000 --screenshot=out.png http://localhost:5173/`.

## How rendering is wired

The component lives in `src/lib/` (public entry `index.ts`, built with `npm run build:lib` into `dist-lib/`). `src/main.ts` is only the demo page and must use the public API, not internal modules.

- `src/lib/core.ts`: `createCylinderFeed(container, options)`. Input (wheel, drag, keyboard, inertia), hover tilt, picking, the rAF loop (it stops when idle and when the container is off screen), `ResizeObserver` / `IntersectionObserver`, the hidden `<ol>` mirror for screen readers and the no-WebGL2 fallback, events, `destroy()`. Each frame calls `painter.update(now, scroll)` and uploads only when that returns true.
- `src/lib/painter.ts`: draws the whole list on an offscreen 2D canvas, including scrolling (via `ctx.setTransform`), the spring animations (stiffness 350, damping 40, matching Magic UI Animated List), hover highlight and `renderItem`. It also does the hit test in content coordinates.
- `src/lib/renderer.ts`: bends that canvas texture over a horizontal-axis cylinder and does ray picking (screen → panel UV through the inverse MVP). The shader only samples the texture. It does not scroll.
- `src/lib/element.ts`: `<cylinder-feed>`. The class is defined inside `defineCylinderFeed()` so importing the package has no side effects and does not break SSR.
- `src/lib/types.ts` is the public contract; `defaults.ts` holds presets (`dark` / `light` / `warm`) and defaults; `icons.ts` holds the Phosphor duotone paths (MIT, credit kept in comments and README).
- Demo content (`NOTICES`, Chinese, design-collaboration theme) lives in `src/main.ts`. The demo maps `html[data-bg]` (`dark` / `light` / `color`, saved in `localStorage['cyl-bg']`) to feed themes with `feed.setTheme()`.
- `src/panel.ts` is the demo-only settings panel (open state in `localStorage['cyl-panel']`). It floats over the top-right corner (the user prefers this to a docked sidebar); long content scrolls inside it and the action buttons stay pinned at the bottom. Each control maps to one option section in `main.ts` (`GROUPS`); live sections go through `feed.setOptions()`, while `cylinder` changes destroy and recreate the instance on slider release, keeping items and scroll. A red dot marks values that differ from `DEFAULTS`, and clicking the value resets it, which matches what "复制配置" outputs.

## Gotchas

- Layout units in `painter.ts` are "content px". `renderer.resize()` returns the cylinder front's on-screen CSS width, and `painter.resize()` sets things up so that 1 content px is 1 screen CSS px and texture pixels match device pixels 1:1. Do not hard-code canvas or texture sizes, and do not adjust font sizes by eye at a single window size: the projection grows with the container **height**.
- `resize` must run before the first `draw`/`upload`. The texture is (re)allocated with `texImage2D` when its size changes and updated with `texSubImage2D` otherwise. Call `generateMipmap` after every upload.
- Alpha is premultiplied end to end: `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, the shader outputs `t * a`, and blending is `ONE, ONE_MINUS_SRC_ALPHA`. Changing any one of the three causes dark or light card fringes.
- Canvas `shadowBlur`/`shadowOffset` ignore the transform, so multiply them by the current scale (`ctx.getTransform().d`).
- Themes are `FeedTheme` objects in `src/lib/defaults.ts`; the painter never reads the DOM. A new demo background needs CSS in `style.css` plus a mapping in `main.ts`.
- The component does not load fonts. It redraws on `document.fonts` `loadingdone`, because canvas text locks in whatever font is loaded when drawn. The demo loads Google Fonts `Noto Sans SC` 400/500, which often fails on Chinese networks; the console error is expected. The font stack is PingFang → Noto Sans SC → Microsoft YaHei.
- Public API names must not shadow DOM members on the custom element (that is why it is `scrollToOffset`, not `scrollTo`).
- Typography is tuned for Chinese UI (14 / 12 / 11 px, 4px grid, hierarchy carried by opacity). The user prefers refined, smaller type and minimal English in the UI.
- When copying SVG path data, compare it against upstream (`phosphor-icons/core/main/assets/duotone/*.svg`) programmatically. Hand copying has introduced typos before.

## Conventions

- Reply to the user and write code comments in Chinese (user steering in `~/.kiro/steering/chinese-reply.md`). Comments are sparse and explain the reason behind the code.
- Files use CRLF line endings.
