# Cylinder Feed · 圆柱 WebGL 通知列表

**卧式圆柱**（绕 X 轴）上的通知列表，复刻 [Magic UI Animated List](https://magicui.design/docs/components/animated-list)：新通知从顶部 spring 缩放入场，旧卡片随之下移。滚轮、拖拽和键盘都能滚动，带轻量惯性；鼠标悬停时整个列表朝光标微微倾斜。

在线演示：https://folded-scroll-edges.pages.dev

零运行时依赖，提供框架无关的核心 API 和 `<cylinder-feed>` Web Component，React、Vue 或原生页面都可以直接用。

## 安装

目前不发布到 npm。先在本仓库构建，再在业务项目里按路径或打包文件安装：

```bash
npm run build:lib                      # 输出 dist-lib/（ESM + .d.ts）
# 在业务项目里
npm install ../folded-scroll-edges     # 或先 npm pack，再安装生成的 .tgz
```

## 用法

### 核心 API

```ts
import { createCylinderFeed, icons } from 'folded-scroll-edges'

const feed = createCylinderFeed(document.getElementById('feed')!, {
  items: [{ id: 1, title: '林晓评论了设计稿', description: '按钮间距再大一点', time: '2 分钟前', icon: icons.comment, color: '#2F5FB3' }],
  theme: 'dark',
})

feed.push({ title: '设计评审已通过', time: '刚刚' })   // 顶部插入，带入场动画
feed.on('itemclick', ({ item }) => open(item.id))
// 卸载时
feed.destroy()
```

容器必须有确定的宽高，组件会用 `ResizeObserver` 跟随它的尺寸。

### Web Component

```ts
import { defineCylinderFeed } from 'folded-scroll-edges'
defineCylinderFeed()            // 注册 <cylinder-feed>，可传自定义标签名
```

```html
<cylinder-feed theme="light" autoplay interval="1500" label="团队动态" style="height: 600px"></cylinder-feed>
<script type="module">
  const el = document.querySelector('cylinder-feed')
  el.items = [...]                                  // 数据走属性（property），不走 attribute
  el.addEventListener('itemclick', (e) => console.log(e.detail.item))
</script>
```

| attribute | 说明 |
| --- | --- |
| `theme` | `dark` / `light` / `warm` |
| `autoplay` | 有此属性就按间隔循环插入 `items` |
| `interval` | 自动插入间隔，毫秒 |
| `tilt` | `off` 关闭悬停倾斜 |
| `reduced-motion` | `auto`（默认）/ `true` / `false` |
| `label` | 无障碍名称 |

property：`items`、`options`（完整配置）、`theme`、`feed`（内部实例）。方法：`push()`、`scrollToOffset()`、`play()`、`pause()`。事件：`itemclick`、`itemhover`、`feedscroll`，数据在 `event.detail`，会冒泡并穿出 shadow DOM。

在 React 里用：`<cylinder-feed ref={el => el && (el.items = items)} />`。React 19 之前的版本不会把对象透传成 property，所以要用 ref 赋值。

## 配置

所有字段都可选。尺寸单位是“内容 px”：圆柱正面上 1 内容 px 约等于 1 屏幕 CSS px，所以 `titleSize: 14` 在屏幕上看到的就是 14px。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `items` | `[]` | `FeedItem[]`：`title` 必填，`description`、`time`、`icon`、`color`、`id` 可选 |
| `theme` | `'dark'` | 预设名，或 `{ base: 'light', card: '#fafafa', ... }` 覆盖部分字段 |
| `layout` | 见 `defaultLayout` | `cardMaxWidth` 360、`itemHeight` 64、`gap` 8、`radius` 16、`font`、字号等 |
| `cylinder` | 见 `defaultCylinder` | `arc` 128°、`fov` 70.6°、`feather` 0.22、`edgeFade` 0.14、`maxDpr` 2、`loop` false。`loop: true` 闭合成整圈、无限滚动，背面自动隐藏。只在创建时生效 |
| `motion` | 见 `defaultMotion` | `reducedMotion: 'auto'`、`spring { stiffness: 350, damping: 40 }`、`inertia`、`wheelSpeed`、`dragSpeed` |
| `tilt` | `{ yaw: 3, pitch: 2, pull: 0.012, smoothing: 0.16 }` | 悬停倾斜，`false` 关闭。角度不建议超过 5°，文字会变软 |
| `autoplay` | `false` | `{ interval: 1000, next?: (n) => item }`。没有 `next` 时循环 `items` |
| `maxItems` | `50` | 超出后丢弃最早的条目 |
| `renderItem` | 无 | `(ctx, box, drawDefault) => void`，自绘卡片 |
| `ariaLabel` | `'通知列表'` | 容器的无障碍名称 |

除 `items` 和 `cylinder` 外，其余字段都能用 `feed.setOptions()` 热更新。

### 实例方法

| 方法 | 说明 |
| --- | --- |
| `push(item)` | 顶部插入一条，带入场动画 |
| `setItems(items)` | 整体替换，不播放动画 |
| `remove(item)` | 按对象引用移除一条，下方卡片带动画补位 |
| `redraw()` | 数据没变、但 `renderItem` 的画面随时间变化时请求重画 |
| `scrollToIndex(i, { animate })` / `getCenterIndex()` | 把第 i 条滚到正面中央 / 当前正面中央是第几条 |
| `getItems()` | 当前条目，顶部在前 |
| `setTheme(theme)` / `setOptions(opts)` | 热更新 |
| `scrollTo(px, { animate })` / `getScroll()` / `getMaxScroll()` | 滚动位置，单位是内容 px |
| `play()` / `pause()` | 自动插入 |
| `on(type, fn)` | 返回取消订阅函数。事件：`itemclick`、`itemhover`、`scroll` |
| `destroy()` | 释放 GL 上下文、监听和 DOM，并还原组件改过的容器属性 |
| `supported` | `false` 表示没有 WebGL2，已退回 DOM 列表 |

### 自绘卡片

```ts
createCylinderFeed(el, {
  layout: { itemHeight: 80 },
  renderItem(ctx, box, drawDefault) {
    drawDefault()                                   // 先画内置卡片
    if (box.item.id === 'urgent') {
      ctx.fillStyle = '#e5484d'
      ctx.beginPath()
      ctx.arc(box.x + box.width - 16, box.y + 16, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  },
})
```

`ctx` 已经套好了滚动、入场缩放和透明度，按 `box` 里的内容坐标画就行。canvas 的 `shadowBlur` 和 `shadowOffset` 不受变换影响，自己加阴影时要乘上 `ctx.getTransform().d`。

## 行为说明

- **滚轮**：滚到列表首尾后不再拦截，外层页面可以继续滚。
- **点击**：按下到松开移动不超过 6px 才算点击；列表还在惯性滚动时按下只会让它停住，不触发点击。
- **键盘**：容器可以获得焦点，支持 ↑ ↓、PageUp / PageDown、空格、Home / End。
- **无障碍**：canvas 旁有一份隐藏的同步 `<ol>` 列表，读屏软件能读到内容。
- **性能**：没有动画、输入或自动插入时停掉 rAF；滚出视口时暂停渲染；只有画面变化时才重绘纹理。
- **降级**：没有 WebGL2 时，隐藏的 `<ol>` 直接显示为普通列表。WebGL 上下文丢失后会自动重建。
- **字体**：canvas 文字按绘制时已加载的字体渲染，字体晚到后组件会自动重画。字体由使用方自行加载。
- **减少动态**：跟随 `prefers-reduced-motion`，关闭惯性、入场动画和悬停倾斜。

## 探索页

`explore/` 下有四个演示，都只用公开 API，`npm run dev` 后从 `/explore/scroll.html` 进入，页面顶部可以互相切换：

- **手卷**（`scroll.html`）：《春江花月夜》一联一行卷在圆柱上，滚得比列表慢，卷尾一枚朱印。
- **无常**（`decay.html`）：通知只停留 24 秒，越来越淡，到期用 `remove()` 离开，点一下可以提前放下。
- **节气**（`loop.html`）：`cylinder.loop` 闭合圆柱，二十四节气绕一整圈，今天所在的节气停在正面。
- **呼吸**（`breath.html`）：吸 4 秒、呼 6 秒，每次吸气落下一句，整列随呼吸起伏。

## 本仓库开发

```bash
npm install
npm run dev          # 演示页
npm run build        # 演示页构建到 dist/
npm run build:lib    # 组件库构建到 dist-lib/
npm run pack:worker  # 把 dist/ 打成 Pages 用的 worker
npm run deploy:dry-run  # 本地模拟 Workers Builds 的发布打包，不需要凭据
```

推送后 Cloudflare Workers Builds 会按 `wrangler.jsonc` 把 `dist/` 作为静态资源发布。这份配置必须保留在仓库里，否则构建会自动搭 Vite 插件脚手架并失败。

- `src/lib/`：组件本体，`index.ts` 是公开入口。`core.ts` 负责输入、主循环、observer 和事件，`painter.ts` 用 2D canvas 画卡片和 spring 动画，`renderer.ts` 负责 WebGL2 圆柱和拾取，`element.ts` 是 Web Component。
- `src/main.ts`：演示页，只通过公开 API 使用组件。`src/panel.ts` 是演示页右上角的参数面板，可以实时调节各项配置，并复制出对应的 `createCylinderFeed` 代码。
- 图标取自 [Phosphor Icons](https://phosphoricons.com) duotone（MIT）。
