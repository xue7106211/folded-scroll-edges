# Folded Scroll Edges · 纸张折叠的滚动边缘

复刻 [@enesozturkdev 的 “Folded scroll edges with HTML-in-Canvas”](https://x.com/enesozturkdev/status/2115816197266477213)：一个可滚动的列表，上下边缘像纸一样卷折向远处。列表内容是薛一飞（Allen）的真实职业经历与项目（`src/content.json`）。

在线演示：https://folded-scroll-edges.pages.dev

## 技术栈与选择理由

**Vite + 原生 TypeScript + 手写 WebGL2 着色器，零运行时依赖。**

- 效果的核心只是「一张 DOM 纹理 + 一个顶点着色器」，引入 Three.js / React 只会增加体积，构建产物约 11 KB（gzip）。
- Vite 提供开发服务器与生产构建；TypeScript 保证 Chrome 新 API 的调用位置清晰可查。
- 部署到 Cloudflare Pages（静态资源被打包进 `_worker.js`，见 `scripts/build-pages-worker.mjs`）。

## 两种渲染模式

页面顶部的徽标会显示当前模式。

### 1. HTML-in-Canvas（Chrome 157+，主路径）

- `<canvas content="drawable">` 内放一个带 `drawable` 属性的真实滚动列表，它仍然是可滚动、可选中、可被读屏器读取的 DOM。
- 每次 `paint` 事件里用 `gl.texElementSubImage2D()` 把列表上传为纹理（先 `texImage2D(..., null)` 预分配）。
- 顶点着色器把 160 行细分网格的上下 22% 卷到半径 `R = F / (π/2)` 的圆柱上（90° 卷曲），再做透视投影，并按法线角度压暗。
- 中间平坦区与 DOM 1:1 对应，所以 `canvas.updateElementGeometry(list, { canvasTransform: new DOMMatrix() })` 即可让点击、滚动、焦点框对齐。

### 2. CSS 3D 降级（Safari / Firefox / 移动端 / 旧版 Chrome）

- 真实列表用 `clip-path` 只露出中间平坦区。
- 上下边缘各由 6 条细条带拼成，每条装一份 `aria-hidden` 的列表克隆，随滚动同步；条带按递增角度 `rotateX` 串接，近似出与着色器相同的圆柱卷曲，并用 `brightness` 模拟光照。
- 访问 `?mode=css` 可在 Chrome 157+ 上强制查看降级模式。

## 视觉风格：Caldera — Pixelated Cyber-Playground

- 色板：Basalt Canvas `#e2e2df` 页面底、Ash White `#f7f6f2` 卡片、Abyssal Ink `#070607` 文字、Digital Orange `#fc5000` 主按钮与重点卡片、Cyber Violet `#524ae9` 仅用于装饰图形、Pixel Glare `#f5f28e` 高光。
- 字体：标题 Bebas Neue（替代 PP Neue Corp Compact Ultrabold），中文回落 Noto Sans SC 900；正文 DM Sans 500。
- 40px 卡片圆角、800px 胶囊按钮，扁平无阴影；Hero 背景是 `src/blobs.ts` 用低分辨率 canvas + Bayer 有序抖动生成的橙/紫像素团块。
- 列表卡片本身就是 WebGL 纹理的来源，新样式会原样进入着色器（着色器底色同步为 `#e2e2df`）。

## 本地开发

```bash
npm install
npm run dev        # 开发
npm run build      # 构建到 dist/
npm run pack:worker  # 把 dist/ 打成 Pages 用的 _worker.js
```

截图：`shots/`（`*-default.png` 为无标志的无头 Chromium 156 → CSS 模式；`*-canvas.png` 为加 `--enable-experimental-web-platform-features` → HTML-in-Canvas 模式）。

## 已知限制

- WebGL 模式下，卷折区域里的像素与 DOM 命中区域不完全对应（只有平坦区可点击）。
- CSS 模式下，在折叠条带上触摸拖动无法滚动（鼠标滚轮已转发）。
