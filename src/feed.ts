// 在 2D canvas 中复刻 Magic UI Animated List（通知卡片 + spring 入场 + layout 位移），作为圆柱纹理

// 图标取自 Phosphor Icons duotone（MIT © Phosphor Icons, https://phosphoricons.com），viewBox 256
// 每个图标两层：[0] 是 20% 透明度的底色块，[1] 是主线条
const ICONS = {
  comment: [
    'M224,128A96,96,0,0,1,79.93,211.11h0L42.54,223.58a8,8,0,0,1-10.12-10.12l12.47-37.39h0A96,96,0,1,1,224,128Z',
    'M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-4-1.08,7.85,7.85,0,0,0-2.53.42L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm-44,0a12,12,0,1,1-12-12A12,12,0,0,1,96,128Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,128Z',
  ],
  launch: [
    'M184,120v61.65a8,8,0,0,1-2.34,5.65l-34.35,34.35a8,8,0,0,1-13.57-4.53L128,176ZM136,72H74.35a8,8,0,0,0-5.65,2.34L34.35,108.69a8,8,0,0,0,4.53,13.57L80,128ZM40,216c37.65,0,50.69-19.69,54.56-28.18L68.18,161.44C59.69,165.31,40,178.35,40,216Z',
    'M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z',
  ],
  invite: [
    'M168,100a60,60,0,1,1-60-60A60,60,0,0,1,168,100Z',
    'M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136Zm-57.87,58.85a8,8,0,0,1-12.26,10.3C165.75,181.19,138.09,168,108,168s-57.75,13.19-77.87,37.15a8,8,0,0,1-12.25-10.3c14.94-17.78,33.52-30.41,54.17-37.17a68,68,0,1,1,71.9,0C164.6,164.44,183.18,177.07,198.13,194.85ZM108,152a52,52,0,1,0-52-52A52.06,52.06,0,0,0,108,152Z',
  ],
  edit: [
    'M128,48,68.32,70.38a8,8,0,0,0-5.08,6.17L40,216l139.45-23.24a8,8,0,0,0,6.17-5.08L208,128Zm-4,104a20,20,0,1,1,20-20A20,20,0,0,1,124,152Z',
    'M248,92.68a15.86,15.86,0,0,0-4.69-11.31L174.63,12.68a16,16,0,0,0-22.63,0L123.57,41.11l-58,21.77A16.06,16.06,0,0,0,55.35,75.23L32.11,214.68A8,8,0,0,0,40,224a8.4,8.4,0,0,0,1.32-.11l139.44-23.24a16,16,0,0,0,12.35-10.17l21.77-58L243.31,104A15.87,15.87,0,0,0,248,92.68Zm-69.87,92.19L63.32,204l47.37-47.37a28,28,0,1,0-11.32-11.32L52,192.7,71.13,77.86,126,57.29,198.7,130ZM112,132a12,12,0,1,1,12,12A12,12,0,0,1,112,132Zm96-15.32L139.31,48l24-24L232,92.68Z',
  ],
  approve: [
    'M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z',
    'M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z',
  ],
  mention: [
    'M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z',
    'M128,24a104,104,0,0,0,0,208c21.51,0,44.1-6.48,60.43-17.33a8,8,0,0,0-8.86-13.33C166,210.38,146.21,216,128,216a88,88,0,1,1,88-88c0,26.45-10.88,32-20,32s-20-5.55-20-32V88a8,8,0,0,0-16,0v4.26a48,48,0,1,0,5.93,65.1c6,12,16.35,18.64,30.07,18.64,22.54,0,36-17.94,36-48A104.11,104.11,0,0,0,128,24Zm0,136a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z',
  ],
} satisfies Record<string, [string, string]>

type Notice = { name: string; description: string; time: string; icon: keyof typeof ICONS; color: string }

// 新卡片插在顶部、按数组顺序循环，所以数组从旧到新排，列表从上往下读才是越来越早
// 底块是一组压暗的印刷色卡色，白色图形在每块上的对比度都 ≥ 3.8:1
const NOTICES: Notice[] = [
  { name: '许诺在讨论中提到了你', description: '看下图标风格是否统一', time: '30 分钟前', icon: 'mention', color: '#9E3F5C' },
  { name: '设计评审已通过', description: '会员中心改版，由王蕾确认', time: '20 分钟前', icon: 'approve', color: '#4F7A43' },
  { name: '周宁更新了组件库', description: '按钮、输入框等 12 个组件有改动', time: '15 分钟前', icon: 'edit', color: '#3A7480' },
  { name: '陈默邀请你加入项目', description: '品牌升级 2027 · 可编辑', time: '10 分钟前', icon: 'invite', color: '#A87A1E' },
  { name: '首页改版 v3 已发布', description: '已同步到「品牌官网」团队库', time: '5 分钟前', icon: 'launch', color: '#C2452D' },
  { name: '林晓评论了设计稿', description: '首页改版第 3 页：按钮间距再大一点', time: '2 分钟前', icon: 'comment', color: '#2F5FB3' },
]

const ICON_PATHS = new Map<string, [Path2D, Path2D]>()
const iconPaths = (key: keyof typeof ICONS) => {
  let p = ICON_PATHS.get(key)
  if (!p) {
    p = [new Path2D(ICONS[key][0]), new Path2D(ICONS[key][1])]
    ICON_PATHS.set(key, p)
  }
  return p
}

/** 超出宽度时截断并补省略号，对应原组件的 overflow-hidden */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  const chars = [...text]
  while (chars.length && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop()
  return chars.join('') + '…'
}

// 以下尺寸单位是“内容 px”。resize() 让 1 内容 px ≈ 圆柱正面的 1 个屏幕 CSS px，
// 所以这里写的字号就是最终看到的字号。层级参考中文产品常用的 14 / 12 / 11，间距走 4px 栅格
const MIN_CONTENT_W = 300
const PAD_X = 8
const CARD_MAX_W = 360
const CARD_PAD_X = 16
const CARD_PAD_Y = 12
const TITLE_SIZE = 14
const TITLE_LH = 20
const DESC_SIZE = 12
const DESC_LH = 18
const TEXT_GAP = 2
const TIME_SIZE = 11
const CARD_H = CARD_PAD_Y * 2 + TITLE_LH + TEXT_GAP + DESC_LH
const GAP = 8
const SLOT = CARD_H + GAP
const RADIUS = 16
const ICON = 32
const ICON_RADIUS = 8
const ICON_GAP = 12
const GLYPH = 16
const MAX_TEX_W = 2048
const FONT = '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'

// motion 的 spring { stiffness: 350, damping: 40 }，mass = 1
const STIFFNESS = 350
const DAMPING = 40
const DELAY = 1000
const PREFILL = 20
const MAX_ITEMS = 50

type Item = { notice: Notice; y: number; vy: number; s: number; vs: number }

type Theme = 'dark' | 'light' | 'color'

// 纯白在深色底上会发散，主色降到 92%；彩色主题用暖灰阶，跟实色卡面同一色调
const TEXT: Record<Theme, { fg: string; secondary: string; muted: string }> = {
  dark: { fg: 'rgb(255 255 255 / 0.92)', secondary: 'rgb(255 255 255 / 0.62)', muted: 'rgb(255 255 255 / 0.5)' },
  light: { fg: 'rgb(0 0 0 / 0.88)', secondary: 'rgb(0 0 0 / 0.64)', muted: 'rgb(0 0 0 / 0.55)' },
  color: { fg: '#efe9de', secondary: '#aaa398', muted: '#8a847a' },
}

export type Feed = {
  canvas: HTMLCanvasElement
  /** pageWidth / pageHeight，圆柱面板保持同样比例以免拉伸 */
  pageAspect: number
  /** 传入圆柱正面在屏幕上的宽度（CSS px），据此重设内容坐标和纹理分辨率 */
  resize: (panelCssW: number, dpr: number) => void
  /** 当前可滚动的最大距离（内容 px） */
  maxScroll: () => number
  /** 推进动画；画面有变化时重绘并返回 true */
  update: (now: number, scroll: number) => boolean
}

function stepSpring(x: number, v: number, target: number, dt: number): [number, number] {
  const a = -STIFFNESS * (x - target) - DAMPING * v
  v += a * dt
  return [x + v * dt, v]
}

export function createFeed(reduceMotion = false): Feed {
  const pageAspect = 1 / 1.4
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  let contentW = MIN_CONTENT_W
  let viewHeight = contentW / pageAspect
  let padTop = 0
  let k = 1

  let count = 0
  const items: Item[] = []
  const insert = (settled: boolean) => {
    const notice = NOTICES[count++ % NOTICES.length]
    items.unshift({ notice, y: 0, vy: 0, s: settled ? 1 : 0, vs: 0 })
    if (items.length > MAX_ITEMS) items.pop()
    if (settled) items.forEach((it, i) => (it.y = i * SLOT))
  }
  for (let i = 0; i < PREFILL; i++) insert(true)

  let nextAt = performance.now() + DELAY
  let last = performance.now()
  let lastScroll = NaN
  let lastTheme = ''
  let animating = false

  const resize = (panelCssW: number, dpr: number) => {
    // 面板够宽时 1:1 显示；窗口太矮、面板太窄时整体等比缩小，避免标题被截掉太多
    contentW = Math.max(panelCssW, MIN_CONTENT_W)
    viewHeight = contentW / pageAspect
    // 面板上下各约 22% 被羽化遮罩吃掉，留出空白让首尾卡片能滚到正面
    padTop = Math.round(viewHeight * 0.26)
    // 纹理像素与正面的设备像素 1:1，文字不经过缩放采样
    const w = Math.round(Math.min(MAX_TEX_W, Math.max(256, panelCssW * dpr)))
    const h = Math.round(w / pageAspect)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    k = w / contentW
    lastScroll = NaN
  }

  const paintCard = (it: Item, theme: Theme) => {
    const w = Math.min(contentW - PAD_X * 2, CARD_MAX_W)
    const x = (contentW - w) / 2
    const top = padTop + it.y
    const s = Math.min(1, Math.max(0, it.s))
    if (s <= 0.001) return

    ctx.save()
    ctx.globalAlpha = s
    // originY: 0 —— 以卡片顶边中点为缩放原点
    ctx.translate(x + w / 2, top)
    ctx.scale(s, s)
    ctx.translate(-(x + w / 2), -top)

    const shadowK = k * s
    if (theme === 'dark') {
      ctx.beginPath()
      ctx.roundRect(x, top, w, CARD_H, RADIUS)
      // 近似 inset box-shadow: 0 -20px 80px -20px #ffffff1f
      const g = ctx.createLinearGradient(0, top + CARD_H, 0, top)
      g.addColorStop(0, 'rgb(255 255 255 / 0.12)')
      g.addColorStop(0.7, 'rgb(255 255 255 / 0.02)')
      g.addColorStop(1, 'rgb(255 255 255 / 0.02)')
      ctx.fillStyle = g
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgb(255 255 255 / 0.1)'
      ctx.beginPath()
      ctx.roundRect(x + 0.5, top + 0.5, w - 1, CARD_H - 1, RADIUS - 0.5)
      ctx.stroke()
    } else if (theme === 'color') {
      // 彩色背景是照片，半透明卡片会让字落在杂色上，所以用实色暖灰卡面 + 中性投影
      ctx.fillStyle = '#1c1a18'
      ctx.shadowColor = 'rgb(0 0 0 / 0.35)'
      ctx.shadowOffsetY = 8 * shadowK
      ctx.shadowBlur = 24 * shadowK
      ctx.beginPath()
      ctx.roundRect(x, top, w, CARD_H, RADIUS)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgb(239 233 222 / 0.08)'
      ctx.beginPath()
      ctx.roundRect(x + 0.5, top + 0.5, w - 1, CARD_H - 1, RADIUS - 0.5)
      ctx.stroke()
    } else {
      // canvas 的 shadow 不受变换影响，需要手动乘缩放
      ctx.fillStyle = '#fff'
      for (const [oy, blur] of [[12, 24], [2, 4]]) {
        ctx.shadowColor = 'rgb(0 0 0 / 0.05)'
        ctx.shadowOffsetY = oy * shadowK
        ctx.shadowBlur = blur * shadowK
        ctx.beginPath()
        ctx.roundRect(x, top, w, CARD_H, RADIUS)
        ctx.fill()
      }
      ctx.shadowColor = 'transparent'
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgb(0 0 0 / 0.03)'
      ctx.stroke()
    }

    const { notice } = it
    const iconX = x + CARD_PAD_X
    const iconY = top + (CARD_H - ICON) / 2
    ctx.fillStyle = notice.color
    ctx.beginPath()
    ctx.roundRect(iconX, iconY, ICON, ICON, ICON_RADIUS)
    ctx.fill()
    const [duo, line] = iconPaths(notice.icon)
    ctx.save()
    ctx.translate(iconX + (ICON - GLYPH) / 2, iconY + (ICON - GLYPH) / 2)
    ctx.scale(GLYPH / 256, GLYPH / 256)
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = s * 0.2
    ctx.fill(duo)
    ctx.globalAlpha = s
    ctx.fill(line)
    ctx.restore()

    // 层级靠字重和透明度拉开，字号只差一档；次要色按卡面算过，对比度不低于 4.5:1
    const { fg, secondary, muted } = TEXT[theme]
    const textX = iconX + ICON + ICON_GAP
    const textMax = x + w - CARD_PAD_X - textX
    const titleY = top + CARD_PAD_Y + TITLE_LH / 2
    const descY = top + CARD_PAD_Y + TITLE_LH + TEXT_GAP + DESC_LH / 2
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `${TIME_SIZE}px ${FONT}`
    const timeW = ctx.measureText(notice.time).width
    const dotW = ctx.measureText('·').width + 8
    ctx.font = `500 ${TITLE_SIZE}px ${FONT}`
    const name = fitText(ctx, notice.name, textMax - dotW - timeW)
    ctx.fillStyle = fg
    ctx.fillText(name, textX, titleY)
    let tx = textX + ctx.measureText(name).width + 4
    // 分隔点和时间都用次要色、小一号，跟标题拉开层级
    ctx.font = `${TIME_SIZE}px ${FONT}`
    ctx.fillStyle = muted
    ctx.fillText('·', tx, titleY)
    tx += dotW - 4
    ctx.fillText(notice.time, tx, titleY)

    ctx.font = `400 ${DESC_SIZE}px ${FONT}`
    ctx.fillStyle = secondary
    ctx.fillText(fitText(ctx, notice.description, textMax), textX, descY)
    ctx.restore()
  }

  const paint = (scroll: number, theme: Theme) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(k, 0, 0, k, 0, -scroll * k)
    for (const it of items) {
      const top = padTop + it.y
      if (top + CARD_H < scroll || top > scroll + viewHeight) continue
      paintCard(it, theme)
    }
  }

  return {
    canvas,
    pageAspect,
    resize,
    maxScroll: () => Math.max(0, padTop * 2 + items.length * SLOT - GAP - viewHeight),
    update(now, scroll) {
      let changed = false
      // 标签页切到后台时 rAF 暂停，回来后不补插一大串
      if (now - nextAt > DELAY * 3) nextAt = now
      while (now >= nextAt) {
        insert(reduceMotion)
        nextAt += DELAY
        animating = !reduceMotion
        changed = true
      }

      if (animating) {
        let dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        const h = 1 / 240
        let moving = false
        while (dt > 0) {
          const step = Math.min(h, dt)
          dt -= step
          items.forEach((it, i) => {
            ;[it.y, it.vy] = stepSpring(it.y, it.vy, i * SLOT, step)
            ;[it.s, it.vs] = stepSpring(it.s, it.vs, 1, step)
          })
        }
        items.forEach((it, i) => {
          if (Math.abs(it.y - i * SLOT) < 0.05 && Math.abs(it.vy) < 0.05) {
            it.y = i * SLOT
            it.vy = 0
          } else moving = true
          if (Math.abs(it.s - 1) < 0.001 && Math.abs(it.vs) < 0.001) {
            it.s = 1
            it.vs = 0
          } else moving = true
        })
        animating = moving
        changed = true
      }
      last = now

      const bg = document.documentElement.dataset.bg
      const theme: Theme = bg === 'light' || bg === 'color' ? bg : 'dark'
      if (theme !== lastTheme || scroll !== lastScroll) changed = true
      lastTheme = theme
      lastScroll = scroll

      if (changed) paint(scroll, theme)
      return changed
    },
  }
}
