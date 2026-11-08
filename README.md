# Cylinder Scroll · 全屏圆柱 WebGL 滚动

全屏黑底**卧式圆柱**（绕 X 轴）：上半《百年孤独》中文经典段落，下半程序生成缩略图网格。滚轮 / 纵向拖拽驱动旋转，带轻量惯性。

在线演示：https://folded-scroll-edges.pages.dev

## 技术栈

**Vite + 原生 TypeScript + 手写 WebGL2，零运行时依赖。**

- 离屏 2D canvas 绘制 Atlas（中文段落 + 伪随机缩略图），上传为纹理。
- 水平轴向圆柱网格 + 透视投影；片元只采样纹理。
- 部署到 Cloudflare Pages（静态资源打包进 `_worker.js`，见 `scripts/build-pages-worker.mjs`）。

## 本地开发

```bash
npm install
npm run dev        # 开发
npm run build      # 构建到 dist/
npm run pack:worker  # 把 dist/ 打成 Pages 用的 _worker.js
```

## 交互

- 滚轮 / 纵向拖拽：绕 X 轴旋转（内容上下卷动）
- 拉过起点 / 终点：iOS 式双曲阻尼回弹；露出灰白斜条纹与「Overscroll」
- `prefers-reduced-motion: reduce`：关闭惯性，直接跟手
- [/compare](/compare)：Most apps（1:1）vs iPhone（阻尼）对照与自动演示

```bash
npm test                 # 阻尼纯函数单元测试
npm run record:artifacts # Playwright 390×844 录屏 / 截图 → artifacts/
```

需要 WebGL2；不支持时显示简短提示。
