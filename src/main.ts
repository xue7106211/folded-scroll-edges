import './style.css'
import { createFeed } from './feed'
import { createCylinder } from './cylinder'

const canvas = document.getElementById('c') as HTMLCanvasElement
const fallback = document.getElementById('fallback') as HTMLParagraphElement

const THEME_COLORS: Record<string, string> = {
  dark: '#070707',
  light: '#eceae4',
  color: '#141312',
}

function applyBg(mode: 'dark' | 'light' | 'color') {
  document.documentElement.dataset.bg = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[mode])
  document.querySelectorAll<HTMLButtonElement>('.bg-switch [data-bg]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.bg === mode))
  })
}

function initBgSwitch() {
  const saved = localStorage.getItem('cyl-bg') as 'dark' | 'light' | 'color' | null
  const initial =
    saved === 'dark' || saved === 'light' || saved === 'color'
      ? saved
      : matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
  applyBg(initial)

  document.querySelector('.bg-switch')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-bg]')
    if (!btn?.dataset.bg) return
    const mode = btn.dataset.bg as 'dark' | 'light' | 'color'
    localStorage.setItem('cyl-bg', mode)
    applyBg(mode)
  })
}

initBgSwitch()

async function waitFonts() {
  try {
    // 描述用 400、标题用 500，两档都要提前到位，否则 canvas 会用相近字重顶替
    await Promise.all([document.fonts.load('400 12px "Noto Sans SC"'), document.fonts.load('500 34px "Noto Sans SC"')])
    await document.fonts.ready
  } catch {
    /* system Chinese fallback still works */
  }
}

async function start() {
  await waitFonts()

  const dprCap = Math.min(window.devicePixelRatio || 1, 2)
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const feed = createFeed(reduceMotion)
  const renderer = createCylinder(canvas, feed)

  if (!renderer) {
    canvas.hidden = true
    fallback.hidden = false
    return
  }

  // 输入累积的“弧度”换算成列表滚动距离（内容 px），数值与旧版手感一致
  const pxPerRot = 170
  const clampRot = (r: number) => Math.min(Math.max(r, 0), feed.maxScroll() / pxPerRot)

  let targetRot = 0
  let rot = 0
  let velocity = 0
  let dragging = false
  let lastY = 0
  let lastT = 0

  const resize = () => {
    const panelCssW = renderer.resize(window.innerWidth, window.innerHeight, dprCap)
    feed.resize(panelCssW, dprCap)
    targetRot = clampRot(targetRot)
    rot = clampRot(rot)
  }
  resize()
  addEventListener('resize', resize)

  // Vertical scroll → rotate around X
  const addDelta = (dy: number) => {
    const next = dy * 0.0042
    if (reduceMotion) {
      targetRot = clampRot(targetRot + next)
      rot = targetRot
      velocity = 0
    } else {
      targetRot = clampRot(targetRot + next)
      velocity += next * 0.35
    }
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      addDelta(delta)
    },
    { passive: false },
  )

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    lastY = e.clientY
    lastT = performance.now()
    velocity = 0
    canvas.setPointerCapture(e.pointerId)
  })

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const now = performance.now()
    const dy = e.clientY - lastY
    const dt = Math.max(8, now - lastT)
    addDelta(dy * 1.15)
    if (!reduceMotion) velocity = (dy / dt) * 0.35
    lastY = e.clientY
    lastT = now
  })

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)

  // 悬停倾斜：靠近光标的一侧微微抬向观者，并朝光标挪一点，像被轻轻吸住
  const MAX_PITCH = (2 * Math.PI) / 180
  const MAX_YAW = (3 * Math.PI) / 180
  const PULL = 0.012 // 约 1% 面板宽
  const TILT_TAU = 0.16 // 跟随的时间常数（秒），留一点滞后才有"被拉过去"的感觉
  let aimX = 0
  let aimY = 0
  let hoverX = 0
  let hoverY = 0
  let lastFrame = performance.now()
  const clamp1 = (v: number) => Math.min(1, Math.max(-1, v))
  // 触屏没有悬停；减少动态时整段关闭
  if (!reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      aimX = clamp1((e.clientX / innerWidth) * 2 - 1)
      aimY = clamp1(1 - (e.clientY / innerHeight) * 2)
    })
    const reset = () => {
      aimX = 0
      aimY = 0
    }
    document.documentElement.addEventListener('pointerleave', reset)
    addEventListener('blur', reset)
  }

  const tick = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
    lastFrame = now
    // 指数趋近，与帧率无关
    const f = 1 - Math.exp(-dt / TILT_TAU)
    hoverX += (aimX - hoverX) * f
    hoverY += (aimY - hoverY) * f
    renderer.setTilt(hoverY * MAX_PITCH, -hoverX * MAX_YAW, hoverX * PULL, hoverY * PULL)
    if (!dragging) {
      if (reduceMotion) {
        rot = targetRot
        velocity = 0
      } else {
        velocity *= 0.92
        const next = clampRot(targetRot + velocity)
        // 撞到列表首尾时清掉惯性
        if (next !== targetRot + velocity) velocity = 0
        targetRot = next
        rot += (targetRot - rot) * 0.18
        if (Math.abs(velocity) < 1e-5 && Math.abs(targetRot - rot) < 1e-5) {
          velocity = 0
          rot = targetRot
        }
      }
    } else {
      rot += (targetRot - rot) * (reduceMotion ? 1 : 0.35)
    }

    if (feed.update(now, rot * pxPerRot)) renderer.upload()
    renderer.draw()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

void start()
