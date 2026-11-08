import { createServer } from 'vite'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'artifacts')
const optArtifacts = '/opt/cursor/artifacts'
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(optArtifacts, { recursive: true })

function copyArtifact(src, name) {
  const dest = path.join(optArtifacts, name)
  fs.copyFileSync(src, dest)
  fs.copyFileSync(src, path.join(outDir, name))
  console.log('artifact', dest)
  return dest
}

async function waitForDemoDone(page, timeout = 30000) {
  await page.waitForFunction(
    () => document.querySelector('.compare')?.getAttribute('data-demo-state') === 'done',
    null,
    { timeout },
  )
}

const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
})
await server.listen()
const base = 'http://127.0.0.1:5179'
console.log('dev server', base)

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
})

try {
  // --- Record /compare auto-demo ---
  const videoDir = path.join(outDir, 'video-tmp')
  fs.rmSync(videoDir, { recursive: true, force: true })
  fs.mkdirSync(videoDir, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await page.goto(`${base}/compare`, { waitUntil: 'networkidle' })
  await waitForDemoDone(page, 45000)
  // Hold final formula state briefly for the recording tail
  await page.waitForTimeout(1200)
  const shotCompare = 'compare_formula_final_v2.png'
  await page.screenshot({
    path: path.join(outDir, shotCompare),
    type: 'png',
  })
  copyArtifact(path.join(outDir, shotCompare), shotCompare)

  await context.close()
  const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'))
  if (!videos.length) throw new Error('No Playwright video produced')
  const webmSrc = path.join(videoDir, videos[0])
  const webmName = 'compare_demo_390x844_v2.webm'
  const webmOut = path.join(outDir, webmName)
  fs.renameSync(webmSrc, webmOut)
  copyArtifact(webmOut, webmName)

  // Best-effort mp4 via ffmpeg if available
  const mp4Name = 'compare_demo_390x844_v2.mp4'
  const mp4Out = path.join(outDir, mp4Name)
  const ff = spawn('ffmpeg', ['-y', '-i', webmOut, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4Out], {
    stdio: 'inherit',
  })
  const ffCode = await new Promise((resolve) => ff.on('close', resolve))
  if (ffCode === 0 && fs.existsSync(mp4Out)) {
    copyArtifact(mp4Out, mp4Name)
  } else {
    console.warn('ffmpeg mp4 conversion skipped/failed; webm is available')
  }

  // --- Homepage overscroll screenshot ---
  const home = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })
  await home.goto(`${base}/`, { waitUntil: 'networkidle' })
  await home.waitForFunction(() => window.__cylinderScroll, null, { timeout: 15000 })
  await home.waitForTimeout(400)
  await home.evaluate(() => {
    localStorage.setItem('cyl-bg', 'dark')
    document.documentElement.dataset.bg = 'dark'
    document.querySelectorAll('.bg-switch [data-bg]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.bg === 'dark'))
    })
    window.__cylinderScroll.scrollToEnd({ hard: true })
  })
  await home.waitForTimeout(200)

  // Drag upward from lower half to overscroll past the end
  const box = await home.locator('#c').boundingBox()
  if (!box) throw new Error('canvas missing')
  const x = box.x + box.width / 2
  const y0 = box.y + box.height * 0.85
  const y1 = box.y + box.height * 0.12
  await home.mouse.move(x, y0)
  await home.mouse.down()
  await home.mouse.move(x, y1, { steps: 40 })
  await home.waitForTimeout(300)
  const shotHome = 'home_overscroll_v3.png'
  await home.screenshot({
    path: path.join(outDir, shotHome),
    type: 'png',
  })
  copyArtifact(path.join(outDir, shotHome), shotHome)
  await home.mouse.up()
  await home.close()
} finally {
  await browser.close()
  await server.close()
}

console.log('done')
