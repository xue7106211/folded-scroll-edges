// Two-tone pixelated blobs (orange + violet metaballs), ordered-dithered at low res, upscaled with pixelated rendering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export function drawBlobs(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const frame = (t: number) => {
    const W = Math.max(48, Math.round(c.clientWidth / 12)), H = Math.max(24, Math.round(c.clientHeight / 12))
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    const img = ctx.createImageData(W, H), s = t / 4000
    const balls = [
      [0.22 + 0.06 * Math.sin(s), 0.35 + 0.08 * Math.cos(s * 1.3), 0.28, 0],
      [0.38 + 0.05 * Math.cos(s * 0.8), 0.78, 0.22, 0],
      [0.78 + 0.05 * Math.sin(s * 1.1), 0.3 + 0.07 * Math.sin(s), 0.26, 1],
      [0.62 + 0.06 * Math.cos(s * 0.7), 0.85, 0.2, 1],
    ]
    const asp = W / H
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let fo = 0, fv = 0
      for (const [bx, by, r, k] of balls) { const dx = (x / W - bx) * asp, dy = y / H - by, f = (r * r) / (dx * dx + dy * dy + 1e-4); if (k) fv += f; else fo += f }
      const f = fo + fv, th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16, i = (y * W + x) * 4
      if (f > 0.6 + th * 0.7) {
        const glare = f > 2.6 + th * 2
        const col = glare ? [245, 242, 142] : fo > fv ? [252, 80, 0] : [82, 74, 233]
        img.data.set([...col, 255], i)
      }
    }
    ctx.putImageData(img, 0, 0)
    if (!reduce) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
