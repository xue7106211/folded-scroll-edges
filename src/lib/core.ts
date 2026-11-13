import { createPainter } from './painter'
import { createRenderer, type Renderer } from './renderer'
import { defaultAutoplay, defaultCylinder, defaultLayout, defaultMotion, defaultTilt, resolveTheme } from './defaults'
import type {
  CylinderFeed,
  CylinderFeedEventMap,
  CylinderFeedOptions,
  FeedItem,
  FeedTheme,
  LiveOptions,
  MotionOptions,
  TiltOptions,
} from './types'

const DEG = Math.PI / 180
// 原版惯性是按 60fps 每帧调的，这里折算成与帧率无关的形式
const FRAME = 1 / 60
const DECAY = 0.92
const EASE = 0.18
const EASE_DRAG = 0.35
const WHEEL_INERTIA = 0.35
const FLING = 59.5
const CLICK_SLOP = 6

const hiddenStyle =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap'

export function createCylinderFeed<T extends FeedItem = FeedItem>(
  container: HTMLElement,
  options: CylinderFeedOptions<T> = {},
): CylinderFeed<T> {
  const cyl = { ...defaultCylinder, ...options.cylinder }
  let layout = { ...defaultLayout, ...options.layout }
  let theme: FeedTheme = resolveTheme(options.theme)
  let motion: MotionOptions = { ...defaultMotion, ...options.motion }
  let tilt: TiltOptions | null = options.tilt === false ? null : { ...defaultTilt, ...options.tilt }
  let autoplay = options.autoplay ? { ...defaultAutoplay, ...options.autoplay } : null
  let renderItem = options.renderItem
  const seed = options.items?.slice() ?? []

  // ---- DOM ----
  const ac = new AbortController()
  const { signal } = ac
  const restore: (() => void)[] = []
  const setStyle = (el: HTMLElement, prop: string, value: string) => {
    const prev = el.style.getPropertyValue(prop)
    el.style.setProperty(prop, value)
    restore.push(() => el.style.setProperty(prop, prev))
  }
  const setAttr = (name: string, value: string) => {
    if (container.hasAttribute(name)) return
    container.setAttribute(name, value)
    restore.push(() => container.removeAttribute(name))
  }
  if (getComputedStyle(container).position === 'static') setStyle(container, 'position', 'relative')
  setAttr('tabindex', '0')
  setAttr('role', 'region')
  setAttr('aria-label', options.ariaLabel ?? '通知列表')

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  // 纵向手势自己处理，横向留给页面
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-x;cursor:grab'
  if (cyl.edgeFade > 0) {
    const e = Math.min(50, cyl.edgeFade * 100)
    const mask = `linear-gradient(to bottom, transparent 0%, #000 ${e}%, #000 ${100 - e}%, transparent 100%)`
    canvas.style.setProperty('mask-image', mask)
    canvas.style.setProperty('-webkit-mask-image', mask)
  }
  // 画在 canvas 上的文字读屏软件拿不到，旁边放一份同步的 DOM 列表；不支持 WebGL2 时它直接显示出来
  const list = document.createElement('ol')
  list.style.cssText = hiddenStyle
  container.append(canvas, list)

  // ---- 渲染 ----
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)')
  const reduced = () => (motion.reducedMotion === 'auto' ? reduceQuery.matches : motion.reducedMotion)
  const painter = createPainter<T>({
    layout,
    theme,
    spring: motion.spring,
    maxItems: options.maxItems ?? 50,
    feather: cyl.feather,
    loop: cyl.loop,
    renderItem,
  })
  painter.setItems(seed)
  // 闭合圆柱就是展开 360° 的面板
  const geometry = { ...cyl, arc: cyl.loop ? 360 : cyl.arc }
  let renderer: Renderer | null = null
  try {
    renderer = createRenderer(canvas, painter.pageAspect, geometry)
  } catch (err) {
    console.error('[cylinder-feed] WebGL 初始化失败，退回 DOM 列表', err)
  }
  const supported = renderer !== null

  // ---- 状态 ----
  type Listener = (e: never) => void
  const listeners = new Map<keyof CylinderFeedEventMap<T>, Set<Listener>>()
  const emit = <K extends keyof CylinderFeedEventMap<T>>(type: K, e: CylinderFeedEventMap<T>[K]) =>
    listeners.get(type)?.forEach((fn) => (fn as (e: CylinderFeedEventMap<T>[K]) => void)(e))

  let destroyed = false
  let visible = true
  let playing = autoplay !== null
  let nextAt = 0
  let inserted = 0
  let raf = 0
  let lastFrame = 0
  let target = 0
  let pos = 0
  let velocity = 0
  let lastEmitted = NaN
  let dragging = false
  let down: { x: number; y: number; id: number; moving: boolean } | null = null
  let lastY = 0
  let lastT = 0
  let aimX = 0
  let aimY = 0
  let hoverX = 0
  let hoverY = 0
  let pointer: { x: number; y: number } | null = null
  let needsUpload = true
  let needsDraw = true
  let listDirty = true
  let cssW = 0
  let cssH = 0

  const clamp = (v: number) => (cyl.loop ? v : Math.min(Math.max(v, 0), painter.maxScroll()))
  const pow = (base: number, dt: number) => Math.pow(base, dt / FRAME)

  const pickIndex = (x: number, y: number) => {
    const uv = renderer?.pick(x, y)
    return uv ? painter.hitTest(uv.u, uv.v, pos) : -1
  }
  let hoverKey: object | null = null
  let cursorStale = false
  const refreshHover = () => {
    const i = pointer && !dragging ? pickIndex(pointer.x, pointer.y) : -1
    const key = i >= 0 ? painter.slotKey(i) : null
    if (key === hoverKey && !cursorStale) return
    cursorStale = false
    painter.setHover(i)
    const item = i >= 0 ? painter.itemAt(i) : null
    canvas.style.cursor = item && listeners.get('itemclick')?.size ? 'pointer' : dragging ? 'grabbing' : 'grab'
    if (key === hoverKey) return
    hoverKey = key
    emit('itemhover', { item, index: i })
  }

  const renderList = () => {
    listDirty = false
    const frag = document.createDocumentFragment()
    for (const it of painter.items()) {
      const li = document.createElement('li')
      li.textContent = [it.title, it.description, it.time].filter(Boolean).join('，')
      if (!supported) {
        li.style.cssText = `list-style:none;margin:0 0 ${layout.gap}px;padding:12px ${layout.paddingX}px;border-radius:${layout.radius}px;background:${theme.card};border:1px solid ${theme.border};color:${theme.text};font:${layout.descriptionSize}px/1.5 ${layout.font}`
      }
      frag.append(li)
    }
    list.replaceChildren(frag)
  }
  if (!supported) {
    canvas.hidden = true
    list.style.cssText = `position:absolute;inset:0;margin:0;padding:${layout.sidePadding}px;overflow:auto;max-width:${layout.cardMaxWidth + layout.sidePadding * 2}px;margin-inline:auto`
  }

  const resize = () => {
    const rect = container.getBoundingClientRect()
    cssW = rect.width
    cssH = rect.height
    if (!renderer || cssW < 1 || cssH < 1) return
    const dpr = Math.min(devicePixelRatio || 1, cyl.maxDpr)
    painter.resize(renderer.resize(cssW, cssH, dpr), dpr)
    target = clamp(target)
    pos = clamp(pos)
    needsUpload = true
    wake()
  }

  // ---- 主循环：没事可做时停掉 rAF，有输入或数据变化再唤醒 ----
  const frame = (now: number) => {
    raf = 0
    if (destroyed) return
    const dt = lastFrame ? Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)) : FRAME
    lastFrame = now
    let active = false

    if (playing && autoplay) {
      // 切到后台或滚出视口回来后，不补插一大串
      if (!nextAt || now - nextAt > autoplay.interval * 3) nextAt = now + (nextAt ? 0 : autoplay.interval)
      while (now >= nextAt) {
        const next = autoplay.next ? autoplay.next(inserted) : seed.length ? seed[inserted % seed.length] : null
        inserted++
        nextAt += autoplay.interval
        if (next) insert(next)
      }
      active = true
    }

    if (dragging) {
      pos += (target - pos) * (reduced() ? 1 : 1 - pow(1 - EASE_DRAG, dt))
    } else if (reduced() || !motion.inertia) {
      velocity = 0
      pos = target
    } else {
      velocity *= pow(DECAY, dt)
      const want = target + velocity * (dt / FRAME)
      const next = clamp(want)
      // 撞到列表首尾时清掉惯性
      if (next !== want) velocity = 0
      target = next
      pos += (target - pos) * (1 - pow(1 - EASE, dt))
      if (Math.abs(velocity) < 0.01 && Math.abs(target - pos) < 0.01) {
        velocity = 0
        pos = target
      }
    }
    if (pos !== target || velocity !== 0 || dragging) active = true

    if (tilt && renderer) {
      // 运行中切到减少动态时，让已有的倾斜回正
      if (reduced()) aimX = aimY = 0
      const f = 1 - Math.exp(-dt / Math.max(0.001, tilt.smoothing))
      hoverX += (aimX - hoverX) * f
      hoverY += (aimY - hoverY) * f
      if (Math.abs(aimX - hoverX) < 1e-4 && Math.abs(aimY - hoverY) < 1e-4) {
        hoverX = aimX
        hoverY = aimY
      } else active = true
      renderer.setTilt(hoverY * tilt.pitch * DEG, -hoverX * tilt.yaw * DEG, hoverX * tilt.pull, hoverY * tilt.pull)
      needsDraw = true
    }

    if (renderer) {
      if (pointer) refreshHover()
      if (painter.update(now, pos)) needsUpload = true
      if (painter.busy()) active = true
      if (needsUpload) {
        renderer.upload(painter.canvas)
        needsUpload = false
        needsDraw = true
      }
      if (needsDraw) {
        renderer.draw()
        needsDraw = false
      }
    }
    if (listDirty) renderList()
    if (pos !== lastEmitted) {
      lastEmitted = pos
      emit('scroll', { scroll: pos, maxScroll: painter.maxScroll() })
    }
    if (active) wake()
  }

  function wake() {
    if (!raf && !destroyed && visible) raf = requestAnimationFrame(frame)
  }

  function insert(item: T) {
    painter.push(item, !reduced())
    listDirty = true
    wake()
  }

  // ---- 输入 ----
  const local = (e: PointerEvent | WheelEvent) => {
    const r = container.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      // deltaMode 1 是按行，2 是按页
      const delta = raw * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cssH : 1) * motion.wheelSpeed
      const next = clamp(target + delta)
      // 已经到头时不拦截，让外层页面接着滚
      if (next === target) return
      e.preventDefault()
      target = next
      if (!reduced() && motion.inertia) velocity += delta * WHEEL_INERTIA
      else pos = target
      wake()
    },
    { passive: false, signal },
  )

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      const p = local(e)
      // 正在惯性滚动时按下只是“停住”，不算点击
      down = { ...p, id: e.pointerId, moving: Math.abs(velocity) > 0.5 || Math.abs(target - pos) > 1 }
      dragging = true
      lastY = e.clientY
      lastT = e.timeStamp
      velocity = 0
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
      wake()
    },
    { signal },
  )

  canvas.addEventListener(
    'pointermove',
    (e) => {
      const p = local(e)
      if (e.pointerType === 'mouse') {
        pointer = p
        if (tilt && !reduced() && cssW && cssH) {
          aimX = Math.min(1, Math.max(-1, (p.x / cssW) * 2 - 1))
          aimY = Math.min(1, Math.max(-1, 1 - (p.y / cssH) * 2))
        }
        wake()
      }
      if (!dragging || e.pointerId !== down?.id) return
      const dy = e.clientY - lastY
      const dtMs = Math.max(8, e.timeStamp - lastT)
      target = clamp(target + dy * motion.dragSpeed)
      if (!reduced() && motion.inertia) velocity = (dy / dtMs) * FLING * (motion.dragSpeed / defaultMotion.dragSpeed)
      lastY = e.clientY
      lastT = e.timeStamp
      wake()
    },
    { signal },
  )

  const endDrag = (e: PointerEvent, cancelled: boolean) => {
    if (!dragging || e.pointerId !== down?.id) return
    dragging = false
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* 已经释放 */
    }
    const p = local(e)
    const start = down
    down = null
    if (!cancelled && !start.moving && Math.hypot(p.x - start.x, p.y - start.y) < CLICK_SLOP) {
      velocity = 0
      const i = pickIndex(p.x, p.y)
      if (i >= 0) emit('itemclick', { item: painter.items()[i], index: i, originalEvent: e })
    }
    canvas.style.cursor = 'grab'
    cursorStale = true
    wake()
  }
  canvas.addEventListener('pointerup', (e) => endDrag(e, false), { signal })
  canvas.addEventListener('pointercancel', (e) => endDrag(e, true), { signal })
  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (e.pointerType !== 'mouse') return
      pointer = null
      aimX = 0
      aimY = 0
      refreshHover()
      wake()
    },
    { signal },
  )

  container.addEventListener(
    'keydown',
    (e) => {
      const page = painter.viewHeight() * 0.6
      const map: Record<string, number> = {
        ArrowDown: target + 48,
        ArrowUp: target - 48,
        PageDown: target + page,
        PageUp: target - page,
        ' ': target + (e.shiftKey ? -page : page),
      }
      // 闭合圆柱没有首尾
      if (!cyl.loop) {
        map.Home = 0
        map.End = painter.maxScroll()
      }
      if (!(e.key in map)) return
      e.preventDefault()
      api.scrollTo(map[e.key])
    },
    { signal },
  )

  reduceQuery.addEventListener('change', () => wake(), { signal })
  // 字体晚到时 canvas 文字已经按回退字体画好了，需要重画
  document.fonts?.addEventListener('loadingdone', () => (painter.invalidate(), wake()), { signal })
  for (const w of ['400', '500']) void document.fonts?.load(`${w} ${layout.titleSize}px ${layout.font}`).catch(() => {})

  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault()
      renderer = null
    },
    { signal },
  )
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      try {
        renderer = createRenderer(canvas, painter.pageAspect, geometry)
      } catch {
        renderer = null
      }
      resize()
    },
    { signal },
  )

  const ro = new ResizeObserver(resize)
  ro.observe(container)
  // 滚出视口时停掉渲染循环
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) wake()
  })
  io.observe(container)
  resize()
  wake()

  const api: CylinderFeed<T> = {
    element: container,
    supported,
    push(item) {
      insert(item)
    },
    setItems(items) {
      seed.splice(0, seed.length, ...items)
      inserted = 0
      painter.setItems(items)
      cursorStale = true
      target = clamp(target)
      pos = clamp(pos)
      listDirty = true
      wake()
    },
    getItems: () => painter.items(),
    remove(item) {
      if (!painter.remove(item, !reduced())) return
      cursorStale = true
      target = clamp(target)
      pos = clamp(pos)
      listDirty = true
      wake()
    },
    redraw() {
      painter.invalidate()
      wake()
    },
    setTheme(t) {
      theme = resolveTheme(t)
      painter.setTheme(theme)
      listDirty = true
      wake()
    },
    setOptions(o: LiveOptions<T>) {
      if (o.theme) api.setTheme(o.theme)
      if (o.layout) {
        layout = { ...layout, ...o.layout }
        painter.setLayout(layout)
        resize()
      }
      if (o.motion) {
        motion = { ...motion, ...o.motion, spring: { ...motion.spring, ...o.motion.spring } }
        painter.setSpring(motion.spring.stiffness, motion.spring.damping)
      }
      if (o.tilt !== undefined) {
        tilt = o.tilt === false ? null : { ...(tilt ?? defaultTilt), ...o.tilt }
        if (!tilt) renderer?.setTilt(0, 0, 0, 0)
        needsDraw = true
      }
      if (o.autoplay !== undefined) {
        autoplay = o.autoplay ? { ...(autoplay ?? defaultAutoplay), ...o.autoplay } : null
        playing = autoplay !== null
        nextAt = 0
      }
      if (o.maxItems !== undefined) painter.setMaxItems(o.maxItems)
      if ('renderItem' in o) {
        renderItem = o.renderItem
        painter.setRenderItem(renderItem)
      }
      if (o.ariaLabel) container.setAttribute('aria-label', o.ariaLabel)
      listDirty = true
      wake()
    },
    scrollTo(scroll, { animate = true } = {}) {
      target = clamp(scroll)
      velocity = 0
      if (!animate || reduced()) pos = target
      wake()
    },
    getScroll: () => pos,
    scrollToIndex(index, opts) {
      api.scrollTo(painter.scrollForIndex(index, target), opts)
    },
    getCenterIndex: () => painter.centerIndex(pos),
    getMaxScroll: () => painter.maxScroll(),
    play() {
      if (!autoplay) autoplay = { ...defaultAutoplay }
      playing = true
      nextAt = 0
      wake()
    },
    pause() {
      playing = false
    },
    on(type, listener) {
      let set = listeners.get(type)
      if (!set) listeners.set(type, (set = new Set()))
      set.add(listener as Listener)
      return () => set.delete(listener as Listener)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (raf) cancelAnimationFrame(raf)
      ac.abort()
      ro.disconnect()
      io.disconnect()
      renderer?.destroy()
      // 主动释放 GL 上下文，页面里反复创建实例时不会撞上浏览器的上下文数量上限
      ;(canvas.getContext('webgl2') as WebGL2RenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
      list.remove()
      restore.reverse().forEach((fn) => fn())
      listeners.clear()
    },
  }
  return api
}
