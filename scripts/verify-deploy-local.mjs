/**
 * Local acceptance for Workers static-asset deploy config:
 * 1) build + wrangler deploy --dry-run (no upload, no interactive scaffold)
 * 2) wrangler dev --local HTTP checks for /, /compare, /compare/
 * 3) representative screenshot proving homepage still loads
 *
 * Does not require Cloudflare credentials or a remote deploy.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'artifacts')
// Optional extra destination for screenshots (e.g. a CI/agent artifacts dir).
const extraArtifacts = process.env.VERIFY_ARTIFACTS_DIR || ''
fs.mkdirSync(outDir, { recursive: true })
if (extraArtifacts) fs.mkdirSync(extraArtifacts, { recursive: true })

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
      ...opts,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
      process.stdout.write(d)
    })
    child.stderr.on('data', (d) => {
      stderr += d
      process.stderr.write(d)
    })
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}`))
    })
  })
}

function copyArtifact(src, name) {
  const local = path.join(outDir, name)
  if (path.resolve(src) !== path.resolve(local)) fs.copyFileSync(src, local)
  console.log('artifact', local)
  if (extraArtifacts) {
    const dest = path.join(extraArtifacts, name)
    fs.copyFileSync(src, dest)
    console.log('artifact', dest)
  }
}

// --- Guard: vite.config must remain free of Cloudflare plugin scaffolding ---
const viteSrc = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8')
if (viteSrc.includes('@cloudflare/vite-plugin') || viteSrc.includes('cloudflare(')) {
  throw new Error('vite.config.ts must not pull in @cloudflare/vite-plugin for this static deploy path')
}
if (!fs.existsSync(path.join(root, 'wrangler.jsonc'))) {
  throw new Error('wrangler.jsonc missing — Workers Builds would attempt interactive scaffolding')
}

console.log('\n== npm run deploy:dry-run ==')
await run('npm', ['run', 'deploy:dry-run'])

// Confirm dist multi-page outputs + redirects copied from public/
for (const rel of ['dist/index.html', 'dist/compare.html', 'dist/_redirects']) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`missing ${rel}`)
}
console.log('dist multi-page + _redirects OK')

// --- Local wrangler assets server ---
const port = 8788
console.log(`\n== wrangler dev --local --port ${port} ==`)
const wrangler = spawn(
  'npx',
  ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port)],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  },
)

let ready = false
const bootLog = []
const onData = (buf) => {
  const s = buf.toString()
  bootLog.push(s)
  process.stdout.write(s)
  if (/Ready on|Local:|http:\/\/127\.0\.0\.1:8788/i.test(s)) ready = true
}
wrangler.stdout.on('data', onData)
wrangler.stderr.on('data', onData)

const base = `http://127.0.0.1:${port}`

async function check(pathname, expect) {
  const res = await fetch(`${base}${pathname}`, { redirect: 'manual' })
  const ct = res.headers.get('content-type') || ''
  const body = res.status < 400 || res.status === 404 ? await res.text() : ''
  const info = { pathname, status: res.status, ct, location: res.headers.get('location') }
  console.log('check', info)

  if (expect.status && res.status !== expect.status) {
    throw new Error(`${pathname}: expected status ${expect.status}, got ${res.status}`)
  }
  if (expect.location) {
    const loc = res.headers.get('location') || ''
    if (!loc.includes(expect.location)) {
      throw new Error(`${pathname}: expected Location containing ${expect.location}, got ${loc}`)
    }
  }
  if (expect.bodyIncludes) {
    for (const s of expect.bodyIncludes) {
      if (!body.includes(s)) throw new Error(`${pathname}: body missing ${JSON.stringify(s)}`)
    }
  }
  if (expect.bodyExcludes) {
    for (const s of expect.bodyExcludes) {
      if (body.includes(s)) throw new Error(`${pathname}: body must not include ${JSON.stringify(s)}`)
    }
  }
  if (expect.isCompare) {
    // compare page title / markers — must not be homepage shell alone
    if (!/compare|Most apps|iPhone/i.test(body)) {
      throw new Error(`${pathname}: does not look like /compare (homepage fallback?)`)
    }
    if (/背景模式|data-bg="dark"/i.test(body) && !/Most apps/i.test(body)) {
      throw new Error(`${pathname}: looks like homepage HTML fallback`)
    }
  }
  if (expect.isHome) {
    if (!/Cylinder Scroll|百年孤独|bg-switch/i.test(body)) {
      throw new Error(`${pathname}: does not look like homepage`)
    }
  }
  return body
}

try {
  const started = Date.now()
  while (!ready && Date.now() - started < 45000) {
    await new Promise((r) => setTimeout(r, 200))
    if (wrangler.exitCode != null) {
      throw new Error(`wrangler exited early: ${wrangler.exitCode}\n${bootLog.join('')}`)
    }
  }
  if (!ready) throw new Error(`wrangler did not become ready\n${bootLog.join('')}`)

  await check('/', {
    status: 200,
    isHome: true,
    bodyIncludes: ['Cylinder Scroll', 'bg-switch'],
  })

  await check('/compare', {
    status: 200,
    isCompare: true,
    bodyIncludes: ['Most apps', 'iPhone', 'compare'],
    bodyExcludes: ['bg-switch'],
  })

  // Trailing slash: either 200 with compare content, or redirect to /compare
  {
    const res = await fetch(`${base}/compare/`, { redirect: 'manual' })
    console.log('check /compare/', {
      status: res.status,
      location: res.headers.get('location'),
    })
    if (res.status === 200) {
      const body = await res.text()
      if (!/Most apps|iPhone/i.test(body)) {
        throw new Error('/compare/ 200 but not compare page — homepage fallback?')
      }
      if (/bg-switch/i.test(body)) throw new Error('/compare/ served homepage')
    } else if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      const loc = res.headers.get('location') || ''
      if (!/\/compare\/?$/.test(new URL(loc, base).pathname.replace(/\/$/, '') + '') && !loc.includes('/compare')) {
        throw new Error(`/compare/ redirected somewhere unexpected: ${loc}`)
      }
      // Follow once and ensure compare HTML
      const followed = await fetch(new URL(loc, base), { redirect: 'follow' })
      const body = await followed.text()
      if (!/Most apps|iPhone/i.test(body)) throw new Error('/compare/ redirect target is not compare page')
    } else {
      throw new Error(`/compare/ unexpected status ${res.status}`)
    }
  }

  // Unknown path must NOT silently become homepage (SPA trap)
  {
    const res = await fetch(`${base}/no-such-page-xyz`, { redirect: 'follow' })
    const body = await res.text()
    console.log('check /no-such-page-xyz', { status: res.status })
    if (res.status === 200 && /Cylinder Scroll|bg-switch/i.test(body) && !/404/i.test(body)) {
      throw new Error('unknown path fell back to homepage (SPA not_found_handling?)')
    }
  }

  // Representative screenshot: homepage via wrangler local
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const shot = path.join(outDir, 'deploy_local_home.png')
  await page.screenshot({ path: shot, type: 'png' })
  copyArtifact(shot, 'deploy_local_home.png')

  await page.goto(`${base}/compare`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const shotCompare = path.join(outDir, 'deploy_local_compare.png')
  await page.screenshot({ path: shotCompare, type: 'png' })
  copyArtifact(shotCompare, 'deploy_local_compare.png')
  await browser.close()

  console.log('\nverify-deploy-local: PASS')
} finally {
  try {
    wrangler.kill('SIGTERM')
  } catch {
    /* ignore */
  }
  // Ensure the whole process group exits (workerd/esbuild children).
  try {
    process.kill(-wrangler.pid, 'SIGKILL')
  } catch {
    try {
      wrangler.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}
