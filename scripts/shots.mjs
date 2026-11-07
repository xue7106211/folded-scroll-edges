import { chromium } from '/workspace/pw-tools/node_modules/playwright/index.mjs'
const url = process.argv[2], out = process.argv[3] || 'shots'
const b = await chromium.launch()
console.log('chromium', b.version())
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(opts)
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${name}.png` })
}
await b.close()
