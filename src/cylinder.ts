import type { Atlas } from './atlas'

const VS = `#version 300 es
in vec3 aPos;
in vec2 aUv;
in float aShade;
uniform mat4 uMVP;
uniform float uScroll;
uniform float uSpan;
out vec2 vUv;
out float vShade;
out float vEdge; // 0 at panel rim → 1 in the middle (panel-local V)
void main() {
  // Panel covers only a slice of the tall atlas; scroll walks through it
  vUv = vec2(aUv.x, aUv.y * uSpan + uScroll);
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
  vec4 t = texture(uTex, vUv);
  float a = vEdge * vShade;
  // Premultiply so transparent edges blend cleanly on any page background
  o = vec4(t.rgb * a, a);
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
  resize: (w: number, h: number, dpr: number) => void
  setRotation: (rad: number) => void
  draw: () => void
  destroy: () => void
}

export function createCylinder(
  canvas: HTMLCanvasElement,
  atlas: Atlas,
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
  const arcLen = panelWidth / atlas.pageAspect
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas)

  const uMVP = gl.getUniformLocation(program, 'uMVP')
  const uTex = gl.getUniformLocation(program, 'uTex')
  const uScroll = gl.getUniformLocation(program, 'uScroll')
  const uSpan = gl.getUniformLocation(program, 'uSpan')

  const span = atlas.span
  let scroll = 0
  let viewW = 1
  let viewH = 1
  let proj = perspective(Math.PI / 2.55, 1, 0.1, 20)
  // Slightly elevated; pull back a touch so the +40% taller page still fits
  const view = lookAt([0, 0.1, 2.7], [0, -0.02, radius * 0.5], [0, 1, 0])

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
    },
    setRotation(rad) {
      // Drag/wheel accumulate "radians"; convert to atlas UV travel
      scroll = rad * 0.08
    },
    draw() {
      const mvp = multiply(proj, multiply(view, IDENTITY))
      gl.viewport(0, 0, viewW, viewH)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uTex, 0)
      gl.uniform1f(uScroll, scroll)
      gl.uniform1f(uSpan, span)
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
