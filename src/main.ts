import './style.css'
import { buildList, buildStats } from './content'
import { drawBlobs } from './blobs'

const stage = document.getElementById('stage')!
const badge = document.getElementById('badge')!
const toggle = document.getElementById('toggle') as HTMLAnchorElement
const forced = new URLSearchParams(location.search).get('mode')
const FOLD = () => Math.round(stage.clientHeight * 0.22)

/* eslint-disable @typescript-eslint/no-explicit-any */
export function supportsHtmlInCanvas(): boolean {
  const c = document.createElement('canvas') as any
  c.setAttribute('content', 'drawable')
  const gl2 = (window as any).WebGL2RenderingContext?.prototype
  return c.content === 'drawable' && !!gl2 && 'texElementSubImage2D' in gl2
}

function setBadge(mode: 'canvas' | 'css', note = '') {
  badge.className = 'badge ' + (mode === 'canvas' ? 'on' : 'css')
  badge.textContent = mode === 'canvas' ? '● HTML-in-Canvas · WebGL 着色器折叠' : '● CSS 3D 降级模式' + note
  if (mode === 'css') { toggle.href = '?'; toggle.textContent = forced === 'css' ? '尝试 HTML-in-Canvas' : '需要 Chrome 157+' }
}

/* ---------------- CSS 3D fallback ----------------
 * The real scroller is clipped to the flat middle band. Each edge is rebuilt from N thin
 * strips, each holding an aria-hidden clone of the list, rotated progressively so the strips
 * chain into a rolled "paper" fold (same geometry as the shader, just discretised). */
function startCss(note = '') {
  stage.innerHTML = ''
  stage.className = 'stage css-mode'
  const list = buildList()
  stage.appendChild(list)
  const N = 6
  type Strip = { el: HTMLDivElement; clone: HTMLElement; row: number }
  const strips: Strip[] = []
  for (let e = 0; e < 2; e++) for (let k = 0; k < N; k++) {
    const el = document.createElement('div'); el.className = 'strip'; el.setAttribute('aria-hidden', 'true')
    const clone = buildList(); clone.classList.add('clone'); clone.removeAttribute('tabindex')
    clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'))
    el.appendChild(clone); stage.appendChild(el); strips.push({ el, clone, row: 0 })
  }
  const layout = () => {
    const F = FOLD(), H = stage.clientHeight, s = F / N, d = Math.PI / 2 / N
    stage.style.setProperty('--fold', F + 'px')
    list.style.clipPath = `inset(${F}px 0 ${F}px 0)`
    strips.forEach((st) => (st.clone.style.height = H + 'px'))
    for (let e = 0; e < 2; e++) {
      let y = e === 0 ? F : H - F, z = 0
      for (let k = 0; k < N; k++) {
        const st = strips[e * N + k], th = (k + 0.5) * d
        st.el.style.height = s + 'px'
        if (e === 0) {
          st.el.style.top = y - s + 'px'; st.el.style.transformOrigin = '50% 100%'
          st.el.style.transform = `translateZ(${z}px) rotateX(${th}rad)`
          st.row = F - (k + 1) * s
          y -= s * Math.cos(th); z -= s * Math.sin(th)
        } else {
          st.el.style.top = y + 'px'; st.el.style.transformOrigin = '50% 0%'
          st.el.style.transform = `translateZ(${z}px) rotateX(${-th}rad)`
          st.row = H - F + k * s
          y += s * Math.cos(th); z -= s * Math.sin(th)
        }
        st.el.style.filter = `brightness(${(1 - 0.7 * Math.sin(th)).toFixed(3)})`
      }
    }
    sync()
  }
  const sync = () => { const t = list.scrollTop; for (const st of strips) st.clone.style.transform = `translateY(${-st.row}px)`, (st.clone.scrollTop = t) }
  list.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true })
  stage.addEventListener('wheel', (ev) => { if (ev.target !== list && !list.contains(ev.target as Node)) list.scrollTop += ev.deltaY }, { passive: true })
  addEventListener('resize', layout)
  layout()
  setBadge('css', note)
}

/* ---------------- HTML-in-Canvas + WebGL ---------------- */
const VS = `#version 300 es
in vec2 aUv; uniform vec2 uSize; uniform float uFold; uniform float uPersp;
out vec2 vUv; out float vShade;
const float HALF_PI = 1.5707963;
void main(){
  vec2 p = aUv * uSize;               // CSS px, y down
  float R = uFold / HALF_PI;          // roll radius: fold band wraps 90deg
  float z = 0.0, ang = 0.0;
  float dTop = uFold - p.y, dBot = p.y - (uSize.y - uFold);
  if (dTop > 0.0) { ang = dTop / R; p.y = uFold - R * sin(ang); z = -R * (1.0 - cos(ang)); }
  else if (dBot > 0.0) { ang = dBot / R; p.y = uSize.y - uFold + R * sin(ang); z = -R * (1.0 - cos(ang)); }
  vec2 c = uSize * 0.5;
  vec2 q = c + (p - c) * uPersp / (uPersp - z);
  vUv = aUv; vShade = 1.0 - 0.7 * sin(min(ang, HALF_PI));
  gl_Position = vec4(q.x / uSize.x * 2.0 - 1.0, 1.0 - q.y / uSize.y * 2.0, 0.0, 1.0);
}`
const FS = `#version 300 es
precision highp float; in vec2 vUv; in float vShade; uniform sampler2D uTex; out vec4 o;
void main(){ vec4 t = texture(uTex, vUv); vec3 bg = vec3(0.886,0.886,0.875);
  o = vec4(mix(bg, t.rgb, vShade * 0.85 + 0.15) * mix(0.72,1.0,vShade), 1.0); }`

function startCanvas() {
  stage.innerHTML = ''
  stage.className = 'stage'
  const canvas = document.createElement('canvas') as any as HTMLCanvasElement & Record<string, any>
  canvas.className = 'gl'
  canvas.setAttribute('content', 'drawable')
  const list = buildList()
  list.setAttribute('drawable', '')
  canvas.appendChild(list)
  stage.appendChild(canvas)
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false }) as WebGL2RenderingContext & Record<string, any>
  if (!gl) throw new Error('no webgl2')
  const sh = (t: number, s: string) => { const x = gl.createShader(t)!; gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)!); return x }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog)
  // subdivided strip grid (dense in Y so the roll is smooth)
  const NX = 2, NY = 160, v: number[] = [], idx: number[] = []
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) v.push(i / NX, j / NY)
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1) }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aUv'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const uSize = gl.getUniformLocation(prog, 'uSize'), uFold = gl.getUniformLocation(prog, 'uFold'), uPersp = gl.getUniformLocation(prog, 'uPersp')
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  let tw = 0, th = 0

  const paint = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight
    const F = FOLD(); stage.style.setProperty('--fold', F + 'px')
    if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr)
    if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr)
    const w = Math.round(list.offsetWidth * dpr), h = Math.round(list.offsetHeight * dpr)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (w !== tw || h !== th) { tw = w; th = h; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null) }
    try { gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, list, { width: w, height: h }) } catch { return }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.886, 0.886, 0.875, 1); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(uSize, W, H); gl.uniform1f(uFold, F); gl.uniform1f(uPersp, H * 1.6)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
    // flat middle region is 1:1 with the DOM, so identity geometry keeps hit-testing / a11y aligned there
    canvas.updateElementGeometry?.(list, { canvasTransform: new DOMMatrix() })
  }
  canvas.addEventListener('paint', paint)
  addEventListener('resize', () => canvas.requestPaint?.())
  list.addEventListener('scroll', () => canvas.requestPaint?.(), { passive: true })
  canvas.requestPaint?.()
  setBadge('canvas')
}

document.getElementById('stats')!.innerHTML = buildStats()
drawBlobs(document.getElementById('blobs') as HTMLCanvasElement)
if (forced !== 'css' && supportsHtmlInCanvas()) {
  try { startCanvas() } catch (e) { console.warn(e); startCss('（WebGL 初始化失败）') }
} else startCss()
