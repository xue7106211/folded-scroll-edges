# Cylinder Scroll · 全屏圆柱 WebGL 滚动

全屏黑底**卧式圆柱**（绕 X 轴）：上半《百年孤独》中文经典段落，下半程序生成缩略图网格。滚轮 / 纵向拖拽驱动旋转，带轻量惯性与 iOS 式过度滚动阻尼。

在线演示：https://folded-scroll-edges.pages.dev

## 技术栈

**Vite + 原生 TypeScript + 手写 WebGL2，零运行时依赖。**

- 离屏 2D canvas 绘制 Atlas（中文段落 + 伪随机缩略图），上传为纹理。
- 水平轴向圆柱网格 + 透视投影；片元只采样纹理。
- **双部署目标**（见下）：Cloudflare **Pages** 直传，或 Cloudflare **Workers**（Git / Workers Builds）静态资产。

## 本地开发

```bash
npm ci                 # 或 npm install
npm run dev            # 开发
npm test               # 单元测试
npm run build          # tsc --noEmit && vite build → dist/
```

## 部署目标区分

| 目标 | 何时用 | 命令 |
|------|--------|------|
| **Workers**（Git 自动部署 / `wrangler deploy`） | Cloudflare 仪表盘连 Git、Workers Builds | 见下方 Workers |
| **Pages** 直传 | 手动 / 脚本上传 `pages-worker.js` | 见下方 Pages |

本仓库是 **多页静态站**（`index.html` + `compare.html`），**不是 SPA**。Workers 配置见根目录 `wrangler.jsonc`（只声明 `assets.directory = ./dist`，**不使用** `@cloudflare/vite-plugin`，避免 CI 自动改 `vite.config`）。

### Workers（推荐给 Git 连接）

Build 设置：

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`（或 `npm run deploy`；wrangler **已钉在** `devDependencies`：`4.158.0`）
- **输出目录:** `dist`（由 `wrangler.jsonc` → `assets.directory` 读取）

本地校验（无需账号、不上传、不改源码）：

```bash
npm run deploy:dry-run       # build + wrangler deploy --dry-run
npm run verify:deploy-local  # dry-run + 本地路由 HTTP 检查 + 截图
```

路由期望：

- `/` → `index.html`
- `/compare` → `compare.html`
- `/compare/` → 重定向到 `/compare` 或同等 compare 内容（**不会**回落到首页）

### Pages（直传 / pack:worker）

```bash
npm run build
npm run pack:worker   # 把 dist/ 打成 pages-worker.js（含 /compare 路由）
```

上传 `pages-worker.js`（或既有 Pages 流水线）。该路径与 Workers `wrangler.jsonc` 并存，互不替代。

## 交互

- 滚轮 / 纵向拖拽：绕 X 轴旋转（内容上下卷动）
- 拉过起点 / 终点：iOS 式双曲阻尼回弹；露出灰白斜条纹与「Overscroll」
- `prefers-reduced-motion: reduce`：关闭惯性，直接跟手
- [/compare](/compare)：Most apps（1:1）vs iPhone（阻尼）对照与自动演示

```bash
npm run record:artifacts # Playwright 390×844 录屏 / 截图 → artifacts/
```

需要 WebGL2；不支持时显示简短提示。

## 文档

- [`docs/decisions.md`](docs/decisions.md) — 架构与部署决策
- [`docs/progress.md`](docs/progress.md) — 进度记录
