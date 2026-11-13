// 在离屏 2D canvas 上画整张列表（含滚动和 spring 动画），作为圆柱纹理。复刻 Magic UI Animated List
import type { FeedIcon, FeedItem, FeedLayout, FeedTheme, ItemBox, RenderItem } from './types'

type Slot<T> = { item: T; y: number; vy: number; s: number; vs: number }

export type Painter<T extends FeedItem> = {
  canvas: HTMLCanvasElement
  /** pageWidth / pageHeight，圆柱面板保持同样比例以免拉伸 */
  pageAspect: number
  /** 传入圆柱正面在屏幕上的宽度（CSS px），据此重设内容坐标和纹理分辨率 */
  resize: (panelCssW: number, dpr: number) => void
  maxScroll: () => number
  /** 可视高度（内容 px），键盘翻页用 */
  viewHeight: () => number
  /** 推进动画；画面有变化时重绘并返回 true */
  update: (now: number, scroll: number) => boolean
  /** 动画是否还没停 */
  busy: () => boolean
  push: (item: T, animate: boolean) => void
  setItems: (items: T[]) => void
  items: () => T[]
  itemAt: (index: number) => T | null
  /** 卡片位置的身份标识。同一个条目对象可能出现在多张卡片上，悬停判断要比这个 */
  slotKey: (index: number) => object | null
  /** 正面中央最近的条目下标，没有条目时为 -1 */
  centerIndex: (scroll: number) => number
  setTheme: (theme: FeedTheme) => void
  setLayout: (layout: FeedLayout) => void
  setSpring: (stiffness: number, damping: number) => void
  setMaxItems: (n: number) => void
  setRenderItem: (fn: RenderItem<T> | undefined) => void
  /** 面板 UV（0–1）→ 条目下标，未命中返回 -1 */
  hitTest: (u: number, v: number, scroll: number) => number
  setHover: (index: number) => void
  /** 强制下一次 update 重绘，如字体加载完成后 */
  invalidate: () => void
}

const PAGE_ASPECT = 1 / 1.4
const MAX_TEX_W = 2048
const TITLE_LH = 20
const DESC_LH = 18
const TEXT_GAP = 2
const ICON_GAP = 12
const GLYPH = 16

/** 超出宽度时截断并补省略号，对应原组件的 overflow-hidden */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  const chars = [...text]
  while (chars.length && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop()
  return chars.join('') + '…'
}

// Path2D 解析不便宜，同一个图标对象只解析一次
const pathCache = new WeakMap<FeedIcon, [Path2D | null, Path2D]>()
function iconPaths(icon: FeedIcon) {
  let p = pathCache.get(icon)
  if (!p) {
    p = [icon.duotone ? new Path2D(icon.duotone) : null, new Path2D(icon.path)]
    pathCache.set(icon, p)
  }
  return p
}

export function createPainter<T extends FeedItem>(init: {
  layout: FeedLayout
  theme: FeedTheme
  spring: { stiffness: number; damping: number }
  maxItems: number
  feather: number
  renderItem?: RenderItem<T>
}): Painter<T> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  let L = init.layout
  let theme = init.theme
  let { stiffness, damping } = init.spring
  let maxItems = init.maxItems
  let renderItem = init.renderItem
  let contentW = L.minWidth
  let viewHeight = contentW / PAGE_ASPECT
  let padTop = 0
  let k = 1
  let slots: Slot<T>[] = []
  let hovered: Slot<T> | null = null
  let last = performance.now()
  let dirty = true
  let lastScroll = NaN
  let animating = false

  const slotH = () => L.itemHeight + L.gap
  const cardW = () => Math.min(contentW - L.sidePadding * 2, L.cardMaxWidth)
  const settle = () => slots.forEach((s, i) => ((s.y = i * slotH()), (s.vy = 0), (s.s = 1), (s.vs = 0)))

  const step = (x: number, v: number, target: number, dt: number): [number, number] => {
    v += (-stiffness * (x - target) - damping * v) * dt
    return [x + v * dt, v]
  }

  const resize = (panelCssW: number, dpr: number) => {
    // 面板够宽时 1:1 显示；太窄时整体等比缩小，避免标题被截掉太多
    contentW = Math.max(panelCssW, L.minWidth)
    viewHeight = contentW / PAGE_ASPECT
    // 留出比羽化区略多的空白，首尾卡片才能滚到正面
    padTop = Math.round(viewHeight * (init.feather + 0.04))
    // 纹理像素与正面的设备像素 1:1，文字不经过缩放采样
    const w = Math.round(Math.min(MAX_TEX_W, Math.max(256, panelCssW * dpr)))
    const h = Math.round(w / PAGE_ASPECT)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    k = w / contentW
    dirty = true
  }

  const drawDefault = (box: ItemBox<T>) => {
    const { item, x, y: top, width: w, height: H, theme: t } = box
    const R = L.radius
    // canvas 的 shadow 不受变换影响，需要手动乘缩放；当前变换的 d 已经是 k × 入场缩放
    const shadowK = ctx.getTransform().d
    let fill: string | CanvasGradient = t.card
    if (t.cardGlow) {
      // 近似 inset box-shadow: 0 -20px 80px -20px，从底边向上渐隐
      const g = ctx.createLinearGradient(0, top + H, 0, top)
      g.addColorStop(0, t.cardGlow)
      g.addColorStop(0.7, t.card)
      g.addColorStop(1, t.card)
      fill = g
    }
    ctx.fillStyle = fill
    const shadows = t.shadows?.length ? t.shadows : [null]
    for (const sh of shadows) {
      if (sh) {
        ctx.shadowColor = sh.color
        ctx.shadowOffsetY = sh.y * shadowK
        ctx.shadowBlur = sh.blur * shadowK
      }
      ctx.beginPath()
      ctx.roundRect(x, top, w, H, R)
      ctx.fill()
    }
    ctx.shadowColor = 'transparent'
    if (box.hovered) {
      ctx.fillStyle = t.hover
      ctx.fill()
    }
    ctx.lineWidth = 1
    ctx.strokeStyle = t.border
    ctx.beginPath()
    ctx.roundRect(x + 0.5, top + 0.5, w - 1, H - 1, R - 0.5)
    ctx.stroke()

    let textX = x + L.paddingX
    if (item.icon) {
      const S = L.iconSize
      const iconY = top + (H - S) / 2
      ctx.fillStyle = item.color ?? t.tile
      ctx.beginPath()
      ctx.roundRect(textX, iconY, S, S, L.iconRadius)
      ctx.fill()
      const [duo, line] = iconPaths(item.icon)
      const vb = item.icon.viewBox ?? 256
      const alpha = ctx.globalAlpha
      ctx.save()
      ctx.translate(textX + (S - GLYPH) / 2, iconY + (S - GLYPH) / 2)
      ctx.scale(GLYPH / vb, GLYPH / vb)
      ctx.fillStyle = t.glyph
      if (duo) {
        ctx.globalAlpha = alpha * 0.2
        ctx.fill(duo)
        ctx.globalAlpha = alpha
      }
      ctx.fill(line)
      ctx.restore()
      textX += S + ICON_GAP
    }

    // 层级靠字重和透明度拉开，字号只差一档；文字块在卡片里垂直居中
    const textMax = x + w - L.paddingX - textX
    const blockH = item.description ? TITLE_LH + TEXT_GAP + DESC_LH : TITLE_LH
    const titleY = top + (H - blockH) / 2 + TITLE_LH / 2
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    let timeW = 0
    let dotW = 0
    if (item.time) {
      ctx.font = `${L.timeSize}px ${L.font}`
      timeW = ctx.measureText(item.time).width
      dotW = ctx.measureText('·').width + 8
    }
    ctx.font = `500 ${L.titleSize}px ${L.font}`
    const title = fitText(ctx, item.title, textMax - dotW - timeW)
    ctx.fillStyle = t.text
    ctx.fillText(title, textX, titleY)
    if (item.time) {
      // 分隔点和时间用弱化色、小一号，跟标题拉开层级
      let tx = textX + ctx.measureText(title).width + 4
      ctx.font = `${L.timeSize}px ${L.font}`
      ctx.fillStyle = t.muted
      ctx.fillText('·', tx, titleY)
      tx += dotW - 4
      ctx.fillText(item.time, tx, titleY)
    }
    if (item.description) {
      ctx.font = `400 ${L.descriptionSize}px ${L.font}`
      ctx.fillStyle = t.secondary
      ctx.fillText(fitText(ctx, item.description, textMax), textX, titleY + TITLE_LH / 2 + TEXT_GAP + DESC_LH / 2)
    }
  }

  const paintSlot = (slot: Slot<T>, index: number) => {
    const w = cardW()
    const x = (contentW - w) / 2
    const top = padTop + slot.y
    const s = Math.min(1, Math.max(0, slot.s))
    if (s <= 0.001) return
    ctx.save()
    ctx.globalAlpha = s
    // originY: 0，以卡片顶边中点为缩放原点
    ctx.translate(x + w / 2, top)
    ctx.scale(s, s)
    ctx.translate(-(x + w / 2), -top)
    const box: ItemBox<T> = {
      item: slot.item, index, x, y: top, width: w, height: L.itemHeight,
      hovered: slot === hovered, theme, layout: L,
    }
    const def = () => {
      ctx.save()
      drawDefault(box)
      ctx.restore()
    }
    if (renderItem) renderItem(ctx, box, def)
    else def()
    ctx.restore()
  }

  const paint = (scroll: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(k, 0, 0, k, 0, -scroll * k)
    slots.forEach((slot, i) => {
      const top = padTop + slot.y
      if (top + L.itemHeight < scroll || top > scroll + viewHeight) return
      paintSlot(slot, i)
    })
  }

  return {
    canvas,
    pageAspect: PAGE_ASPECT,
    resize,
    maxScroll: () => Math.max(0, padTop * 2 + slots.length * slotH() - L.gap - viewHeight),
    viewHeight: () => viewHeight,
    busy: () => animating,
    push(item, animate) {
      slots.unshift({ item, y: 0, vy: 0, s: animate ? 0 : 1, vs: 0 })
      if (slots.length > maxItems) slots.length = maxItems
      if (animate) {
        // 长时间空闲后第一帧的 dt 不要算进动画
        if (!animating) last = performance.now()
        animating = true
      } else settle()
      dirty = true
    },
    setItems(items) {
      slots = items.slice(0, maxItems).map((item) => ({ item, y: 0, vy: 0, s: 1, vs: 0 }))
      settle()
      hovered = null
      animating = false
      dirty = true
    },
    items: () => slots.map((s) => s.item),
    itemAt: (i) => slots[i]?.item ?? null,
    slotKey: (i) => slots[i] ?? null,
    centerIndex(scroll) {
      const cy = scroll + viewHeight / 2
      let best = -1
      let bestD = Infinity
      slots.forEach((s, i) => {
        const d = Math.abs(cy - (padTop + s.y + L.itemHeight / 2))
        if (d < bestD) ((bestD = d), (best = i))
      })
      return best
    },
    setTheme(t) {
      theme = t
      dirty = true
    },
    setLayout(l) {
      L = l
      settle()
      animating = false
      dirty = true
    },
    setSpring(st, d) {
      stiffness = st
      damping = d
    },
    setMaxItems(n) {
      maxItems = Math.max(1, n)
      if (slots.length > maxItems) slots.length = maxItems
      dirty = true
    },
    setRenderItem(fn) {
      renderItem = fn
      dirty = true
    },
    hitTest(u, v, scroll) {
      const cx = u * contentW
      const cy = v * viewHeight + scroll
      const w = cardW()
      const x = (contentW - w) / 2
      if (cx < x || cx > x + w) return -1
      for (let i = 0; i < slots.length; i++) {
        const top = padTop + slots[i].y
        // 入场中的卡片按当前缩放后的高度算，还很小时不让点
        if (slots[i].s > 0.5 && cy >= top && cy <= top + L.itemHeight * slots[i].s) return i
      }
      return -1
    },
    setHover(index) {
      const next = slots[index] ?? null
      if (next !== hovered) {
        hovered = next
        dirty = true
      }
    },
    invalidate() {
      dirty = true
    },
    update(now, scroll) {
      let changed = dirty
      if (animating) {
        let dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        const h = 1 / 240
        while (dt > 0) {
          const st = Math.min(h, dt)
          dt -= st
          slots.forEach((s, i) => {
            ;[s.y, s.vy] = step(s.y, s.vy, i * slotH(), st)
            ;[s.s, s.vs] = step(s.s, s.vs, 1, st)
          })
        }
        let moving = false
        slots.forEach((s, i) => {
          if (Math.abs(s.y - i * slotH()) < 0.05 && Math.abs(s.vy) < 0.05) {
            s.y = i * slotH()
            s.vy = 0
          } else moving = true
          if (Math.abs(s.s - 1) < 0.001 && Math.abs(s.vs) < 0.001) {
            s.s = 1
            s.vs = 0
          } else moving = true
        })
        animating = moving
        changed = true
      }
      last = now
      if (scroll !== lastScroll) changed = true
      lastScroll = scroll
      dirty = false
      if (changed) paint(scroll)
      return changed
    },
  }
}
