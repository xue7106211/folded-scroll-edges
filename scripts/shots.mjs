import { chromium } from '/workspace/pw-tools/node_modules/playwright/index.mjs'
const url = process.argv[2], out = process.argv[3] || 'shots'
const flag = process.argv[4] === 'flag'
const b = await chromium.launch(flag ? { args: ['--enable-experimental-web-platform-features'] } : {})
console.log('chromium', b.version())
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(opts); await p.goto(url, { waitUntil: 'networkidle' })
  await p.evaluate(() => { const s = document.querySelector('.scroller'); s.scrollTop = 360; s.dispatchEvent(new Event('scroll')) })
  await p.waitForTimeout(600)
  console.log(name, await p.textContent('#badge'))
  await p.screenshot({ path: `${out}/${name}${flag ? '-canvas' : '-default'}.png` })
}
await b.close()
