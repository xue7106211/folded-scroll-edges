import './style.css'
import { mountCylinderView } from './cylinderView'

const canvas = document.getElementById('c') as HTMLCanvasElement
const fallback = document.getElementById('fallback') as HTMLParagraphElement
const stage = document.querySelector('.stage') as HTMLElement
const scrollSheet = document.getElementById('scroll-sheet') as HTMLElement

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

void mountCylinderView({
  canvas,
  damping: true,
  translateTarget: scrollSheet,
  fallback,
}).then((view) => {
  if (!view) return
  stage?.classList.add('is-ready')
  // Test hook for Playwright artifact capture (scroll-to-end / overscroll).
  ;(window as unknown as { __cylinderScroll?: typeof view.controller }).__cylinderScroll =
    view.controller
})
