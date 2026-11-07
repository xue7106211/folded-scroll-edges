import { PASSAGES } from './prompts'

export type Atlas = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** How many vertical pages are stacked in the atlas */
  units: number
  /** UV height of one page (= 1/units) */
  span: number
  /** pageWidth / pageHeight — keep panel world aspect equal to this to avoid stretch */
  pageAspect: number
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h % 360} ${s}% ${l}%)`
}

function paintThumb(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number) {
  const rand = mulberry32(seed)
  const kind = Math.floor(rand() * 6)
  const pad = 1
  const s = size - pad * 2
  const cx = x + pad
  const cy = y + pad

  ctx.save()
  ctx.beginPath()
  ctx.rect(cx, cy, s, s)
  ctx.clip()

  const h1 = Math.floor(rand() * 360)
  const h2 = (h1 + 40 + Math.floor(rand() * 80)) % 360

  if (kind === 0) {
    const g = ctx.createLinearGradient(cx, cy, cx + s, cy + s)
    g.addColorStop(0, hsl(h1, 75, 55))
    g.addColorStop(1, hsl(h2, 70, 35))
    ctx.fillStyle = g
    ctx.fillRect(cx, cy, s, s)
  } else if (kind === 1) {
    ctx.fillStyle = hsl(h1, 60, 18)
    ctx.fillRect(cx, cy, s, s)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = hsl(h2 + i * 18, 80, 50 + i * 5)
      const r = s * (0.45 - i * 0.07)
      ctx.beginPath()
      ctx.ellipse(cx + s * 0.5, cy + s * 0.55, r, r * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 2) {
    ctx.fillStyle = hsl(h1, 55, 22)
    ctx.fillRect(cx, cy, s, s)
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = hsl(h2 + i * 12, 85, 55)
      const bx = cx + rand() * s
      const by = cy + rand() * s
      const bw = s * (0.08 + rand() * 0.25)
      const bh = s * (0.08 + rand() * 0.25)
      ctx.fillRect(bx, by, bw, bh)
    }
  } else if (kind === 3) {
    const g = ctx.createRadialGradient(cx + s * 0.35, cy + s * 0.35, s * 0.05, cx + s * 0.5, cy + s * 0.5, s * 0.7)
    g.addColorStop(0, hsl(h1, 90, 70))
    g.addColorStop(0.5, hsl(h2, 80, 45))
    g.addColorStop(1, hsl(h1 + 80, 60, 15))
    ctx.fillStyle = g
    ctx.fillRect(cx, cy, s, s)
  } else if (kind === 4) {
    ctx.fillStyle = hsl(h1, 40, 12)
    ctx.fillRect(cx, cy, s, s)
    ctx.strokeStyle = hsl(h2, 90, 60)
    ctx.lineWidth = Math.max(2, s * 0.04)
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + rand() * s, cy + rand() * s)
      ctx.quadraticCurveTo(cx + rand() * s, cy + rand() * s, cx + rand() * s, cy + rand() * s)
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = hsl(h1, 70, 45)
    ctx.fillRect(cx, cy, s, s)
    ctx.fillStyle = hsl(h2, 85, 65)
    ctx.beginPath()
    ctx.arc(cx + s * 0.5, cy + s * 0.45, s * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = hsl(h1 + 120, 70, 30)
    ctx.fillRect(cx + s * 0.2, cy + s * 0.65, s * 0.6, s * 0.22)
  }

  ctx.restore()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function paintTextBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  passages: string[],
  startIdx: number,
  fontSize: number,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = '#000'
  ctx.fillRect(x, y, w, h)

  const pad = Math.round(fontSize * 0.9)
  const lineH = Math.round(fontSize * 1.75)
  const paraGap = Math.round(fontSize * 0.85)
  ctx.font = `500 ${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.fillStyle = '#f2f2f2'
  ctx.textBaseline = 'top'

  let cy = y + pad
  let pi = startIdx
  const maxW = w - pad * 2
  while (cy + lineH < y + h - pad) {
    const lines = wrapLines(ctx, passages[pi % passages.length], maxW)
    pi++
    for (const ln of lines) {
      if (cy + lineH >= y + h - pad) break
      ctx.fillText(ln, x + pad, cy)
      cy += lineH
    }
    cy += paraGap
  }
  ctx.restore()
  return pi
}

function paintGridBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
) {
  // Square cells filling the band
  const cols = 6
  const cell = Math.max(1, Math.min(Math.floor(w / cols), Math.floor(h / 4)))
  const rows = Math.max(1, Math.floor(h / cell))
  const gw = cell * cols
  const gh = cell * rows
  const ox = x + Math.floor((w - gw) / 2)
  const oy = y + Math.floor((h - gh) / 2)
  let s = seed
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      paintThumb(ctx, ox + c * cell, oy + r * cell, cell, s++)
    }
  }
  return s
}

export function buildAtlas(dpr = 1): Atlas {
  const scale = Math.min(Math.max(dpr, 1), 2)
  // Portrait page: +40% taller than square (width:height = 1:1.4)
  const units = 4
  const pageAspect = 1 / 1.4
  let width = Math.min(2048, Math.round(960 * scale))
  let pageH = Math.round(width / pageAspect)
  let height = pageH * units
  if (height > 8192) {
    height = 8192
    pageH = height / units
    width = Math.round(pageH * pageAspect)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const textH = Math.round(pageH * 0.42)
  const gridH = pageH - textH
  const fontSize = Math.round(28 * scale)

  let passageIdx = 0
  let seed = 0xC0FFEE
  for (let u = 0; u < units; u++) {
    const top = u * pageH
    passageIdx = paintTextBlock(ctx, 0, top, width, textH, PASSAGES, passageIdx, fontSize)
    seed = paintGridBlock(ctx, 0, top + textH, width, gridH, seed)
  }

  return {
    canvas,
    width,
    height,
    units,
    span: 1 / units,
    pageAspect,
  }
}
