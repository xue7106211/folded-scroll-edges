import type { Atlas } from './atlas'
import type { CylinderRenderer } from './cylinder'
import { OVERSCROLL_C, overscrollAmount, rubberBandInvert, visualScrollOffset } from './overscroll'

/** Matches the historical main.ts mapping: dy px → rot → UV. */
export const PX_TO_ROT = 0.0042
export const ROT_TO_UV = 0.08
export const PX_TO_UV = PX_TO_ROT * ROT_TO_UV

export type ScrollControllerOptions = {
  canvas: HTMLCanvasElement
  renderer: CylinderRenderer
  atlas: Atlas
  /** When true, overscroll uses rubber-band; when false, 1:1 past edges. */
  damping: boolean
  /** Element that receives translateY for revealing the stripe backdrop. */
  translateTarget?: HTMLElement
  reduceMotion?: boolean
  /** Wheel overscroll impulse scale (small bump then spring back). */
  wheelOverscrollScale?: number
  /** Invoked after each frame with visual px offset and overscroll amount. */
  onFrame?: (state: { position: number; visual: number; overscroll: number }) => void
}

export type ScrollController = {
  destroy: () => void
  getPosition: () => number
  getVisual: () => number
  getBounds: () => { min: number; max: number; viewport: number }
  setPosition: (px: number, opts?: { hard?: boolean }) => void
  /** Jump to end of content (for compare demo). */
  scrollToEnd: (opts?: { hard?: boolean }) => void
  /** Programmatic finger delta in CSS pixels (positive = finger moves down). */
  applyFingerDelta: (dy: number) => void
  /** Begin / end a programmatic drag (suppresses inertia mid-gesture). */
  beginExternalDrag: () => void
  endExternalDrag: () => void
  /** Enable or disable pointer/wheel listening. */
  setInputEnabled: (enabled: boolean) => void
  setDamping: (damping: boolean) => void
}

export function createScrollController(opts: ScrollControllerOptions): ScrollController {
  const {
    canvas,
    renderer,
    atlas,
    translateTarget = canvas,
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
    wheelOverscrollScale = 0.35,
    onFrame,
  } = opts

  let damping = opts.damping
  let inputEnabled = true
  let externalDrag = false

  const min = 0
  let viewport = Math.max(1, canvas.clientHeight || window.innerHeight)
  let max = Math.max(0, (1 - atlas.span) / PX_TO_UV)

  /** Unconstrained 1:1 finger/content position (px). */
  let position = 0
  /** Smoothed visual position used for rendering. */
  let visual = 0
  let velocity = 0
  let dragging = false
  let lastY = 0
  let lastT = 0
  let raf = 0
  let springing = false

  const clampPos = (v: number) => Math.min(max, Math.max(min, v))

  const mapVisual = (pos: number) =>
    visualScrollOffset(pos, min, max, viewport, damping, OVERSCROLL_C)

  const applyTransform = (vis: number) => {
    const over = overscrollAmount(vis, min, max)
    translateTarget.style.transform = over === 0 ? '' : `translateY(${-over}px)`
    const clamped = clampPos(vis)
    renderer.setRotation(clamped * PX_TO_ROT)
    renderer.draw()
    onFrame?.({ position, visual: vis, overscroll: over })
  }

  const syncViewport = () => {
    viewport = Math.max(1, canvas.clientHeight || window.innerHeight)
    max = Math.max(0, (1 - atlas.span) / PX_TO_UV)
  }

  /** Inverse rubber-band so a new drag continues from the current visual. */
  function undampFromVisual(vis: number): number {
    if (!damping) return vis
    if (vis >= min && vis <= max) return vis
    const d = viewport
    if (vis < min) return min - rubberBandInvert(min - vis, d, OVERSCROLL_C)
    return max + rubberBandInvert(vis - max, d, OVERSCROLL_C)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!inputEnabled || externalDrag) return
    dragging = true
    springing = false
    lastY = e.clientY
    lastT = performance.now()
    velocity = 0
    position = undampFromVisual(visual)
    canvas.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || !inputEnabled) return
    const now = performance.now()
    const dy = e.clientY - lastY
    const dt = Math.max(8, now - lastT)
    // Standard content-follows-finger: finger up → see lower content / past end.
    const delta = -dy * 1.15
    position += delta
    if (!reduceMotion) velocity = (delta / dt) * (1000 / 60) * 0.15
    lastY = e.clientY
    lastT = now
    visual = mapVisual(position)
    applyTransform(visual)
  }

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (position < min || position > max) {
      springing = true
      if (damping) {
        // Spring home from the visible rubber-banded offset (no jump).
        position = visual
        velocity *= 0.35
      }
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (!inputEnabled || externalDrag) return
    e.preventDefault()
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    const atStart = position <= min + 0.5
    const atEnd = position >= max - 0.5
    const goingPastStart = atStart && delta < 0
    const goingPastEnd = atEnd && delta > 0

    if (goingPastStart || goingPastEnd) {
      const bump = delta * wheelOverscrollScale
      position = clampPos(position) + bump
      visual = mapVisual(position)
      springing = true
      velocity = bump * 0.04
      applyTransform(visual)
      return
    }

    if (reduceMotion) {
      position = clampPos(position + delta)
      visual = mapVisual(position)
      velocity = 0
      springing = false
    } else {
      position += delta
      velocity += delta * 0.35
      if (position < min) position = min
      if (position > max) position = max
      visual = mapVisual(position)
      springing = false
    }
    applyTransform(visual)
  }

  const tick = () => {
    if (!dragging && !externalDrag) {
      const outOfBounds = position < min || position > max

      if (outOfBounds || springing) {
        const target = clampPos(position)
        if (reduceMotion) {
          position = target
          visual = target
          velocity = 0
          springing = false
        } else {
          // Critically-ish damped spring — settles without oscillation.
          const disp = target - position
          velocity = velocity * 0.78 + disp * 0.16
          position += velocity
          if (Math.abs(target - position) < 0.2 && Math.abs(velocity) < 0.2) {
            position = target
            velocity = 0
            springing = false
          }
          // Drive visual directly while springing so we don't re-enter the
          // hyperbola (which would fight the spring and jitter).
          visual = position
        }
      } else if (!reduceMotion && Math.abs(velocity) > 1e-3) {
        velocity *= 0.92
        position += velocity
        if (position < min || position > max) {
          springing = true
          if (damping) {
            position = mapVisual(position)
            velocity *= 0.35
          }
          visual = position
        } else {
          visual = position
        }
        if (Math.abs(velocity) < 1e-3) velocity = 0
      } else {
        position = clampPos(position)
        visual = position
        velocity = 0
      }
    } else {
      visual = mapVisual(position)
    }

    applyTransform(visual)
    raf = requestAnimationFrame(tick)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  syncViewport()
  applyTransform(visual)
  raf = requestAnimationFrame(tick)

  return {
    destroy() {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('wheel', onWheel)
      translateTarget.style.transform = ''
    },
    getPosition: () => position,
    getVisual: () => visual,
    getBounds: () => {
      syncViewport()
      return { min, max, viewport }
    },
    setPosition(px, setOpts) {
      syncViewport()
      position = px
      if (setOpts?.hard) {
        visual = mapVisual(position)
        velocity = 0
        springing = false
      } else {
        visual = mapVisual(position)
      }
      applyTransform(visual)
    },
    scrollToEnd(setOpts) {
      syncViewport()
      this.setPosition(max, setOpts)
    },
    applyFingerDelta(dy) {
      // dy: positive = finger moved down → content follows → position decreases
      position -= dy
      visual = mapVisual(position)
      velocity = 0
      applyTransform(visual)
    },
    beginExternalDrag() {
      externalDrag = true
      dragging = false
      springing = false
      velocity = 0
      position = undampFromVisual(visual)
    },
    endExternalDrag() {
      externalDrag = false
      if (position < min || position > max) {
        springing = true
        if (damping) {
          position = visual
          velocity = 0
        }
      }
    },
    setInputEnabled(enabled) {
      inputEnabled = enabled
    },
    setDamping(next) {
      damping = next
    },
  }
}
