import './style.css'
import { buildAtlas } from './atlas'
import { createCylinder } from './cylinder'

const canvas = document.getElementById('c') as HTMLCanvasElement
const fallback = document.getElementById('fallback') as HTMLParagraphElement

const THEME_COLORS: Record<string, string> = {
  dark: '#070707',
  light: '#eceae4',
  color: '#1a0f14',
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
    await document.fonts.load('500 34px "Noto Sans SC"')
    await document.fonts.ready
  } catch {
    /* system Chinese fallback still works */
  }
}

async function start() {
  await waitFonts()

  const dprCap = Math.min(window.devicePixelRatio || 1, 2)
  const atlas = buildAtlas(dprCap)
  const renderer = createCylinder(canvas, atlas)

  if (!renderer) {
    canvas.hidden = true
    fallback.hidden = false
    return
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  let targetRot = 0
  let rot = 0
  let velocity = 0
  let dragging = false
  let lastY = 0
  let lastT = 0

  const resize = () => {
    renderer.resize(window.innerWidth, window.innerHeight, dprCap)
  }
  resize()
  addEventListener('resize', resize)

  // Vertical scroll → rotate around X
  const addDelta = (dy: number) => {
    const next = dy * 0.0042
    if (reduceMotion) {
      targetRot += next
      rot = targetRot
      velocity = 0
    } else {
      targetRot += next
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

  const tick = () => {
    if (!dragging) {
      if (reduceMotion) {
        rot = targetRot
        velocity = 0
      } else {
        velocity *= 0.92
        targetRot += velocity
        rot += (targetRot - rot) * 0.18
        if (Math.abs(velocity) < 1e-5 && Math.abs(targetRot - rot) < 1e-5) {
          velocity = 0
          rot = targetRot
        }
      }
    } else {
      rot += (targetRot - rot) * (reduceMotion ? 1 : 0.35)
    }

    renderer.setRotation(rot)
    renderer.draw()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

void start()
