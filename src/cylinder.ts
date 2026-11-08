import type { Feed } from './feed'

const VS = `#version 300 es
in vec3 aPos;
in vec2 aUv;
in float aShade;
uniform mat4 uMVP;
out vec2 vUv;
out float vShade;
out float vEdge; // 0 at panel rim → 1 in the middle (panel-local V)
void main() {
  // 滚动已在 2D canvas 里完成，纹理恰好是一屏
  vUv = aUv;
  vShade = aShade;
  // Soft vertical mask: fade out near top/bottom of the curved panel
  float feather = 0.22;
  vEdge = smoothstep(0.0, feather, aUv.y) * smoothstep(0.0, feather, 1.0 - aUv.y);
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
  vec4 t = texture(uTex, vUv);
  o = t * (vEdge * vShade);
}`

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

function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
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

function lookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Float32Array {
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

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3]
    }
  }
  return out
}

const IDENTITY = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
])

/**
 * Front-facing cylindrical panel (horizontal axis):
 * UV follows arc length so top/bottom foreshorten as the surface curls away.
 */
function buildCurvedPanel(
  segX: number,
  segY: number,
  radius: number,
  width: number,
  arc: number,
) {
  const positions: number[] = []
  const uvs: number[] = []
  const shades: number[] = []
  const indices: number[] = []
  const stride = segX + 1
  const halfArc = arc / 2

  for (let j = 0; j <= segY; j++) {
    const t = j / segY
    const angle = halfArc - t * arc // top → bottom
    const py = Math.sin(angle) * radius
    const pz = Math.cos(angle) * radius
    // Facing camera at angle=0 → shade 1; darken hard as the surface curls away
    const facing = Math.max(0, Math.cos(angle))
    const shade = 0.18 + 0.82 * Math.pow(facing, 1.35)
    for (let i = 0; i <= segX; i++) {
      const u = i / segX
      const px = (u - 0.5) * width
      positions.push(px, py, pz)
      // Arc-length UV: edges compress in screen space = cylinder perspective
      uvs.push(u, t)
      shades.push(shade)
    }
  }

  // CCW when viewed from +Z (outside the drum)
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * stride + i
      indices.push(a, a + 1, a + stride)
      indices.push(a + 1, a + stride + 1, a + stride)
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    shades: new Float32Array(shades),
    indices: new Uint16Array(indices),
  }
}

export type CylinderRenderer = {
  /** 返回圆柱正面在屏幕上的宽度（CSS px） */
  resize: (w: number, h: number, dpr: number) => number
  /** 把 feed canvas 的最新画面同步到纹理 */
  upload: () => void
  /** 悬停倾斜：pitch 绕 X、yaw 绕 Y（弧度），dx / dy 为平移（面板宽 = 1） */
  setTilt: (pitch: number, yaw: number, dx: number, dy: number) => void
  draw: () => void
  destroy: () => void
}

export function createCylinder(
  canvas: HTMLCanvasElement,
  feed: Pick<Feed, 'canvas' | 'pageAspect'>,
): CylinderRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VS)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS)
  const program = link(gl, vs, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  // Size by arc length so the facing center keeps atlas aspect;
  // large arc → top/bottom curl away with clear foreshortening.
  const panelWidth = 1.0
  const arc = (128 * Math.PI) / 180
  const arcLen = panelWidth / feed.pageAspect
  const radius = arcLen / arc
  const geo = buildCurvedPanel(48, 120, radius, panelWidth, arc)
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const posBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)

  const uvBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
  gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW)
  const aUv = gl.getAttribLocation(program, 'aUv')
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)

  const shadeBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuf)
  gl.bufferData(gl.ARRAY_BUFFER, geo.shades, gl.STATIC_DRAW)
  const aShade = gl.getAttribLocation(program, 'aShade')
  gl.enableVertexAttribArray(aShade)
  gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0)

  const idxBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW)

  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // Canvas origin is top-left; leave unflipped and map UV so v=0 is canvas top
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
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

  let viewW = 1
  let viewH = 1
  let model = IDENTITY
  let proj = perspective(Math.PI / 2.55, 1, 0.1, 20)
  // Slightly elevated; pull back a touch so the +40% taller page still fits
  const view = lookAt([0, 0.1, 2.7], [0, -0.02, radius * 0.5], [0, 1, 0])

  /** 正面（angle = 0）这一行在 NDC 里的 x 坐标 */
  const frontNdcX = (mvp: Float32Array, px: number) => {
    const x = mvp[0] * px + mvp[8] * radius + mvp[12]
    const w = mvp[3] * px + mvp[11] * radius + mvp[15]
    return x / w
  }

  gl.enable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  // Transparent clear — edges fade into whatever CSS background sits behind
  gl.clearColor(0, 0, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  return {
    resize(cssW, cssH, dpr) {
      const w = Math.max(1, Math.floor(cssW * dpr))
      const h = Math.max(1, Math.floor(cssH * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      viewW = w
      viewH = h
      proj = perspective(Math.PI / 2.55, w / h, 0.1, 20)
      gl.viewport(0, 0, w, h)
      const mvp = multiply(proj, view)
      const ndcW = frontNdcX(mvp, panelWidth / 2) - frontNdcX(mvp, -panelWidth / 2)
      return (ndcW / 2) * cssW
    },
    upload() {
      const src = feed.canvas
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
      // 以正面中点 (0, 0, radius) 为轴心：绕圆柱轴本身转 X 看起来会像在滚动
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
    },
    draw() {
      const mvp = multiply(proj, multiply(view, model))
      gl.viewport(0, 0, viewW, viewH)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uTex, 0)
      gl.uniformMatrix4fv(uMVP, false, mvp)
      gl.drawElements(gl.TRIANGLES, geo.indices.length, gl.UNSIGNED_SHORT, 0)
    },
    destroy() {
      gl.deleteBuffer(posBuf)
      gl.deleteBuffer(uvBuf)
      gl.deleteBuffer(shadeBuf)
      gl.deleteBuffer(idxBuf)
      gl.deleteVertexArray(vao)
      gl.deleteTexture(tex)
      gl.deleteProgram(program)
    },
  }
}
