// 把 painter 的 canvas 纹理弯到卧式圆柱（绕 X 轴）上。片元只采样纹理，滚动在 2D canvas 里完成
import type { CylinderOptions } from './types'

const VS = `#version 300 es
in vec3 aPos;
in vec2 aUv;
in float aShade;
uniform mat4 uMVP;
uniform float uFeather;
out vec2 vUv;
out float vShade;
out float vEdge;
void main() {
  vUv = aUv;
  vShade = aShade;
  // 面板上下边缘软羽化
  vEdge = smoothstep(0.0, uFeather, aUv.y) * smoothstep(0.0, uFeather, 1.0 - aUv.y);
  gl_Position = uMVP * vec4(aPos, 1.0);
}`

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
in float vEdge;
uniform sampler2D uTex;
out vec4 o;
void main() {
  // 纹理上传时已预乘 alpha，卡片外的透明区域直接透出页面背景
  o = texture(uTex, vUv) * (vEdge * vShade);
}`

type Mat4 = Float32Array

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'shader error'
    gl.deleteShader(sh)
    throw new Error(log)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) || 'link error'
    gl.deleteProgram(p)
    throw new Error(log)
  }
  return p
}

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  const out = new Float32Array(16)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
  return out
}

function lookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Mat4 {
  const [ex, ey, ez] = eye
  let zx = ex - center[0], zy = ey - center[1], zz = ez - center[2]
  let len = Math.hypot(zx, zy, zz) || 1
  zx /= len; zy /= len; zz /= len
  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  len = Math.hypot(xx, xy, xz) || 1
  xx /= len; xy /= len; xz /= len
  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx
  const out = new Float32Array(16)
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0
  out[12] = -(xx * ex + xy * ey + xz * ez)
  out[13] = -(yx * ex + yy * ey + yz * ez)
  out[14] = -(zx * ex + zy * ey + zz * ez)
  out[15] = 1
  return out
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    }
  }
  return out
}

/** 4×4 求逆（列主序，余子式展开），拾取时把屏幕射线变回面板局部坐标 */
function invert(m: Mat4): Mat4 | null {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (!det) return null
  det = 1 / det
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * det,
    (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det,
    (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det,
    (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det,
    (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det,
    (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det,
    (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det,
    (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det,
    (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ])
}

function transform(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15]
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ]
}

/** UV 按弧长分布，上下卷走的部分在屏幕上自然被压缩 */
function buildCurvedPanel(segX: number, segY: number, radius: number, width: number, arc: number, shadeMin: number) {
  const positions: number[] = []
  const uvs: number[] = []
  const shades: number[] = []
  const indices: number[] = []
  const stride = segX + 1
  for (let j = 0; j <= segY; j++) {
    const t = j / segY
    const angle = arc / 2 - t * arc
    const c = Math.cos(angle)
    const facing = Math.max(0, c)
    // 转到侧面以后再压到 0：闭合圆柱的背面不能透过卡片间隙露出反着的字。128° 以内这一项恒为 1
    const back = Math.min(1, Math.max(0, (c + 0.05) / 0.25))
    const shade = (shadeMin + (1 - shadeMin) * Math.pow(facing, 1.35)) * back * back * (3 - 2 * back)
    for (let i = 0; i <= segX; i++) {
      const u = i / segX
      positions.push((u - 0.5) * width, Math.sin(angle) * radius, Math.cos(angle) * radius)
      uvs.push(u, t)
      shades.push(shade)
    }
  }
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * stride + i
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride)
    }
  }
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    shades: new Float32Array(shades),
    indices: new Uint16Array(indices),
  }
}

export type Renderer = {
  /** 传入容器 CSS 尺寸，返回圆柱正面在屏幕上的宽度（CSS px） */
  resize: (cssW: number, cssH: number, dpr: number) => number
  /** 把源 canvas 的最新画面同步到纹理 */
  upload: (src: HTMLCanvasElement) => void
  /** 悬停倾斜：pitch 绕 X、yaw 绕 Y（弧度），dx / dy 为平移（面板宽 = 1） */
  setTilt: (pitch: number, yaw: number, dx: number, dy: number) => void
  /** 容器内 CSS 坐标 → 面板 UV；没打到面板返回 null */
  pick: (cssX: number, cssY: number) => { u: number; v: number } | null
  draw: () => void
  destroy: () => void
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  pageAspect: number,
  opts: Pick<CylinderOptions, 'arc' | 'fov' | 'feather' | 'shadeMin'>,
): Renderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  if (!gl || gl.isContextLost()) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VS)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS)
  const program = link(gl, vs, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  // 按弧长定半径，正面保持纹理比例
  const panelWidth = 1.0
  const arc = (opts.arc * Math.PI) / 180
  const fovy = (opts.fov * Math.PI) / 180
  const radius = panelWidth / pageAspect / arc
  const geo = buildCurvedPanel(48, arc > Math.PI ? 240 : 120, radius, panelWidth, arc, opts.shadeMin)
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const buffers: WebGLBuffer[] = []
  const attrib = (name: string, data: Float32Array, size: number) => {
    const buf = gl.createBuffer()!
    buffers.push(buf)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
  }
  attrib('aPos', geo.positions, 3)
  attrib('aUv', geo.uvs, 2)
  attrib('aShade', geo.shades, 1)
  const idxBuf = gl.createBuffer()!
  buffers.push(idxBuf)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW)
  gl.bindVertexArray(null)

  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // canvas 原点在左上，不翻转，v = 0 就是 canvas 顶边
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  // 预乘 alpha 要三处一致：这里、片元输出 t * a、混合 ONE / ONE_MINUS_SRC_ALPHA，否则卡片边缘发黑或发白
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  // 正面纹理与屏幕 1:1；上下卷走的部分被压缩，用 mipmap + 各向异性过滤避免文字闪烁
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  if (aniso) {
    const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number
    gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max))
  }
  let texW = 0
  let texH = 0

  const uMVP = gl.getUniformLocation(program, 'uMVP')
  const uTex = gl.getUniformLocation(program, 'uTex')
  const uFeather = gl.getUniformLocation(program, 'uFeather')

  let viewW = 1
  let viewH = 1
  let cssW = 1
  let cssH = 1
  let proj = perspective(fovy, 1, 0.1, 20)
  // 略微俯视
  const view = lookAt([0, 0.1, 2.7], [0, -0.02, radius * 0.5], [0, 1, 0])
  let model = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  let mvp = multiply(proj, multiply(view, model))
  let inv: Mat4 | null = null
  const updateMvp = () => {
    mvp = multiply(proj, multiply(view, model))
    inv = null
  }

  gl.enable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  gl.clearColor(0, 0, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  return {
    resize(w, h, dpr) {
      cssW = Math.max(1, w)
      cssH = Math.max(1, h)
      const pw = Math.max(1, Math.floor(cssW * dpr))
      const ph = Math.max(1, Math.floor(cssH * dpr))
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }
      viewW = pw
      viewH = ph
      proj = perspective(fovy, pw / ph, 0.1, 20)
      updateMvp()
      // 只用 proj · view 量正面宽度，倾斜不应改变内容分辨率
      const pv = multiply(proj, view)
      const ndcX = (px: number) => (pv[0] * px + pv[8] * radius + pv[12]) / (pv[3] * px + pv[11] * radius + pv[15])
      return ((ndcX(panelWidth / 2) - ndcX(-panelWidth / 2)) / 2) * cssW
    },
    upload(src) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      // 尺寸变了要重新分配；否则只覆盖像素
      if (src.width !== texW || src.height !== texH) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
        texW = src.width
        texH = src.height
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src)
      }
      gl.generateMipmap(gl.TEXTURE_2D)
    },
    setTilt(pitch, yaw, dx, dy) {
      // 以正面中点 (0, 0, r) 为轴心：绕圆柱轴本身转 X 看起来会像在滚动
      // model = T(dx, dy, r) · Ry(yaw) · Rx(pitch) · T(0, 0, -r)
      const cx = Math.cos(pitch), sx = Math.sin(pitch)
      const cy = Math.cos(yaw), sy = Math.sin(yaw)
      const r = radius
      model = new Float32Array([
        cy, 0, -sy, 0,
        sy * sx, cx, cy * sx, 0,
        sy * cx, -sx, cy * cx, 0,
        dx - r * sy * cx, dy + r * sx, r - r * cy * cx, 1,
      ])
      updateMvp()
    },
    pick(x, y) {
      inv ??= invert(mvp)
      if (!inv) return null
      const nx = (x / cssW) * 2 - 1
      const ny = 1 - (y / cssH) * 2
      // 近、远裁剪面上的两点连成射线（已在面板局部坐标里），与 y² + z² = r² 求最近交点
      const o = transform(inv, nx, ny, -1)
      const f = transform(inv, nx, ny, 1)
      const d = [f[0] - o[0], f[1] - o[1], f[2] - o[2]]
      const a = d[1] * d[1] + d[2] * d[2]
      const b = 2 * (o[1] * d[1] + o[2] * d[2])
      const c = o[1] * o[1] + o[2] * o[2] - radius * radius
      const disc = b * b - 4 * a * c
      if (a === 0 || disc < 0) return null
      const t = (-b - Math.sqrt(disc)) / (2 * a)
      const px = o[0] + d[0] * t
      const angle = Math.atan2(o[1] + d[1] * t, o[2] + d[2] * t)
      const u = px / panelWidth + 0.5
      const v = (arc / 2 - angle) / arc
      return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null
    },
    draw() {
      gl.viewport(0, 0, viewW, viewH)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uTex, 0)
      gl.uniform1f(uFeather, Math.max(0.001, opts.feather))
      gl.uniformMatrix4fv(uMVP, false, mvp)
      gl.drawElements(gl.TRIANGLES, geo.indices.length, gl.UNSIGNED_SHORT, 0)
    },
    destroy() {
      buffers.forEach((b) => gl.deleteBuffer(b))
      gl.deleteVertexArray(vao)
      gl.deleteTexture(tex)
      gl.deleteProgram(program)
    },
  }
}
