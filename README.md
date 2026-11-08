# Cylinder Scroll · 全屏圆柱 WebGL 滚动

全屏**卧式圆柱**（绕 X 轴）上的通知列表，复刻 [Magic UI Animated List](https://magicui.design/docs/components/animated-list)：每秒在顶部弹出一条新通知（spring 缩放入场），旧卡片随之下移。滚轮 / 纵向拖拽在列表里上下滚动，带轻量惯性。

在线演示：https://folded-scroll-edges.pages.dev

## 技术栈

**Vite + 原生 TypeScript + 手写 WebGL2，零运行时依赖。**

- `src/feed.ts`：离屏 2D canvas 绘制通知卡片（深色 / 浅色两套样式）和 spring 动画；画面变化时才重绘，并用 `texSubImage2D` 同步到纹理。卡片文案为设计协作场景的中文通知，图标取自 [Phosphor Icons](https://phosphoricons.com) duotone（MIT）。
- `src/cylinder.ts`：水平轴向圆柱网格 + 透视投影；片元只采样纹理。
- 部署到 Cloudflare Pages（静态资源打包进 `_worker.js`，见 `scripts/build-pages-worker.mjs`）。

## 本地开发

```bash
npm install
npm run dev        # 开发
npm run build      # 构建到 dist/
npm run pack:worker  # 把 dist/ 打成 Pages 用的 _worker.js
```

## 交互

- 滚轮 / 纵向拖拽：滚动列表，到顶部或底部时停住
- `prefers-reduced-motion: reduce`：关闭惯性和入场动画，直接跟手

需要 WebGL2；不支持时显示简短提示。
