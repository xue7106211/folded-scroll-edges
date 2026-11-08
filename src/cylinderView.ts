import { buildAtlas } from './atlas'
import { createCylinder } from './cylinder'
import { createScrollController, type ScrollController } from './scrollController'

export type CylinderView = {
  controller: ScrollController
  destroy: () => void
  resize: () => void
}

export type MountCylinderOptions = {
  canvas: HTMLCanvasElement
  damping: boolean
  translateTarget?: HTMLElement
  fallback?: HTMLElement | null
  reduceMotion?: boolean
  onFrame?: (state: { position: number; visual: number; overscroll: number }) => void
}

/**
 * Shared mount: atlas + WebGL cylinder + scroll controller.
 * Does not alter cylinder shading / geometry — only drives rotation + CSS translate.
 */
export async function mountCylinderView(opts: MountCylinderOptions): Promise<CylinderView | null> {
  try {
    await document.fonts.load('500 34px "Noto Sans SC"')
    await document.fonts.ready
  } catch {
    /* system Chinese fallback */
  }

  const dprCap = Math.min(window.devicePixelRatio || 1, 2)
  const atlas = buildAtlas(dprCap)
  const renderer = createCylinder(opts.canvas, atlas)

  if (!renderer) {
    opts.canvas.hidden = true
    if (opts.fallback) opts.fallback.hidden = false
    return null
  }

  const resize = () => {
    const parent = opts.canvas.parentElement
    const w = parent?.clientWidth || window.innerWidth
    const h = parent?.clientHeight || window.innerHeight
    renderer.resize(w, h, dprCap)
  }
  resize()

  const controller = createScrollController({
    canvas: opts.canvas,
    renderer,
    atlas,
    damping: opts.damping,
    translateTarget: opts.translateTarget ?? opts.canvas,
    reduceMotion: opts.reduceMotion,
    onFrame: opts.onFrame,
  })

  const onResize = () => {
    resize()
    // Re-assert transform after layout changes
    controller.setPosition(controller.getPosition(), { hard: true })
  }
  addEventListener('resize', onResize)

  return {
    controller,
    resize: onResize,
    destroy() {
      removeEventListener('resize', onResize)
      controller.destroy()
      renderer.destroy()
    },
  }
}
