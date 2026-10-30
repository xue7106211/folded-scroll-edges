import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

function walk(dir, base = '') {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.join(base, name)
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel))
    else out.push(rel.replaceAll('\\', '/'))
  }
  return out
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

const files = walk(dist)
const entries = []
for (const rel of files) {
  const buf = fs.readFileSync(path.join(dist, rel))
  const gz = zlib.gzipSync(buf, { level: 9 })
  const key = '/' + rel
  const ext = path.extname(rel).toLowerCase()
  entries.push({
    key,
    type: types[ext] || 'application/octet-stream',
    b64: gz.toString('base64'),
    raw: buf.length,
    gz: gz.length,
  })
}

const mapLiteral = entries
  .map(
    (e) =>
      `  ${JSON.stringify(e.key)}: { b64: ${JSON.stringify(e.b64)}, type: ${JSON.stringify(e.type)} }`,
  )
  .join(',\n')

const worker = `const FILES = {\n${mapLiteral}\n};

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let p = url.pathname;
    if (p === '/') p = '/index.html';
    let file = FILES[p];
    if (!file) {
      file = FILES['/index.html'];
      if (!file) return new Response('Not Found', { status: 404 });
    }
    const raw = await gunzip(b64ToBytes(file.b64));
    const headers = {
      'content-type': file.type,
      'cache-control': p.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60',
      'x-robots-tag': 'noindex, nofollow',
    };
    return new Response(raw, { status: 200, headers });
  },
};
`

const out = path.join(root, 'pages-worker.js')
fs.writeFileSync(out, worker)
const meta = {
  files: entries.map(({ key, raw, gz, type }) => ({ key, raw, gz, type })),
  workerBytes: Buffer.byteLength(worker),
}
fs.writeFileSync(path.join(root, 'pages-worker-meta.json'), JSON.stringify(meta, null, 2))
console.log(JSON.stringify(meta, null, 2))
