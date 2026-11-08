import './compare.css'
import { mountCylinderView, type CylinderView } from './cylinderView'
import type { ScrollController } from './scrollController'

const CAPTIONS = [
  'Pull past the end of a page.',
  'Same pull. One follows your finger, one resists.',
  'A hyperbola: the further you pull, the less it moves.',
] as const

const root = document.querySelector('.compare') as HTMLElement
const captionEl = document.getElementById('caption') as HTMLParagraphElement
const replayBtn = document.getElementById('replay') as HTMLButtonElement
const fallback = document.getElementById('fallback') as HTMLParagraphElement

const linearCanvas = document.getElementById('c-linear') as HTMLCanvasElement
const dampedCanvas = document.getElementById('c-damped') as HTMLCanvasElement
const linearDot = document.querySelector('[data-side="linear"] .touch-dot') as HTMLElement
const dampedDot = document.querySelector('[data-side="damped"] .touch-dot') as HTMLElement
const formulaLinear = document.querySelector('[data-formula="linear"]') as HTMLElement
const formulaDamped = document.querySelector('[data-formula="damped"]') as HTMLElement

let linearView: CylinderView | null = null
let dampedView: CylinderView | null = null
let demoToken = 0
let demoRunning = false

function setDemoState(state: string) {
  root.dataset.demoState = state
}

function sleep(ms: number, token: number) {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => {
      if (token !== demoToken) reject(new Error('cancelled'))
      else resolve()
    }, ms)
    if (token !== demoToken) {
      clearTimeout(t)
      reject(new Error('cancelled'))
    }
  })
}

function setCaption(text: string) {
  captionEl.textContent = text
}

function showDot(el: HTMLElement, y: number, visible: boolean) {
  el.hidden = false
  el.style.top = `${y}px`
  el.dataset.visible = visible ? 'true' : 'false'
}

function hideDots() {
  for (const el of [linearDot, dampedDot]) {
    el.dataset.visible = 'false'
    window.setTimeout(() => {
      if (el.dataset.visible !== 'true') el.hidden = true
    }, 280)
  }
}

function showFormulas(show: boolean) {
  for (const el of [formulaLinear, formulaDamped]) {
    el.hidden = false
    el.dataset.show = show ? 'true' : 'false'
  }
}

function setInputsEnabled(enabled: boolean) {
  linearView?.controller.setInputEnabled(enabled)
  dampedView?.controller.setInputEnabled(enabled)
}

function resetToEnd() {
  linearView?.controller.scrollToEnd({ hard: true })
  dampedView?.controller.scrollToEnd({ hard: true })
}

async function animatePull(
  controllers: ScrollController[],
  dots: HTMLElement[],
  pullPx: number,
  durationMs: number,
  token: number,
) {
  for (const c of controllers) c.beginExternalDrag()
  const card = dots[0].parentElement as HTMLElement
  const startY = card.clientHeight * 0.72
  const endY = startY - pullPx

  for (const dot of dots) showDot(dot, startY, true)
  await sleep(280, token)

  const steps = Math.max(24, Math.round(durationMs / 16))
  let prevY = startY
  for (let i = 1; i <= steps; i++) {
    if (token !== demoToken) throw new Error('cancelled')
    const t = i / steps
    // Smooth ease-in-out
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const y = startY + (endY - startY) * e
    const dy = y - prevY
    for (const c of controllers) c.applyFingerDelta(dy)
    for (const dot of dots) showDot(dot, y, true)
    prevY = y
    await sleep(durationMs / steps, token)
  }

  await sleep(220, token)
  for (const c of controllers) c.endExternalDrag()
  hideDots()
}

async function waitSettled(controllers: ScrollController[], token: number) {
  const start = performance.now()
  while (performance.now() - start < 2200) {
    if (token !== demoToken) throw new Error('cancelled')
    const busy = controllers.some((c) => {
      const { min, max } = c.getBounds()
      const v = c.getVisual()
      return v < min - 0.5 || v > max + 0.5
    })
    if (!busy) return
    await sleep(50, token)
  }
}

async function runDemo() {
  if (!linearView || !dampedView) return
  const token = ++demoToken
  demoRunning = true
  setDemoState('playing')
  replayBtn.hidden = true
  showFormulas(false)
  setInputsEnabled(false)
  resetToEnd()
  setCaption(CAPTIONS[0])

  try {
    await sleep(700, token)
    setCaption(CAPTIONS[1])

    const pull = Math.min(210, linearView.controller.getBounds().viewport * 0.28)
    await animatePull(
      [linearView.controller, dampedView.controller],
      [linearDot, dampedDot],
      pull,
      1600,
      token,
    )

    await waitSettled([linearView.controller, dampedView.controller], token)
    await sleep(250, token)

    setCaption(CAPTIONS[2])
    showFormulas(true)
    await sleep(900, token)

    setDemoState('done')
    setInputsEnabled(true)
    replayBtn.hidden = false
  } catch {
    if (token === demoToken) {
      setDemoState('done')
      setInputsEnabled(true)
      replayBtn.hidden = false
    }
  } finally {
    if (token === demoToken) demoRunning = false
  }
}

function replay() {
  if (demoRunning) return
  void runDemo()
}

async function start() {
  setDemoState('booting')
  const linearSheet = linearCanvas.closest('.scroll-sheet') as HTMLElement
  const dampedSheet = dampedCanvas.closest('.scroll-sheet') as HTMLElement

  const [linear, damped] = await Promise.all([
    mountCylinderView({
      canvas: linearCanvas,
      damping: false,
      translateTarget: linearSheet,
      fallback: null,
    }),
    mountCylinderView({
      canvas: dampedCanvas,
      damping: true,
      translateTarget: dampedSheet,
      fallback: null,
    }),
  ])

  if (!linear || !damped) {
    fallback.hidden = false
    setDemoState('error')
    return
  }

  linearView = linear
  dampedView = damped
  setInputsEnabled(false)
  resetToEnd()
  setDemoState('ready')
  replayBtn.addEventListener('click', replay)
  await runDemo()
}

void start()
