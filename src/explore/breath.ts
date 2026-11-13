// 呼吸：吸 4 秒、呼 6 秒，每分钟 6 次。每次吸气时落下一句，整列随呼吸起伏
import { createCylinderFeed, type FeedItem } from '../lib'
import { cssVar, mountNav } from './nav'

mountNav('breath')

interface Breath extends FeedItem {
  n: number
}

const INHALE = 4000
const CYCLE = 10_000
// 起伏的幅度（内容 px）
const RISE = 10

const LINES = [
  '吸气，知道自己在吸气',
  '呼气，知道自己在呼气',
  '肩膀放下来',
  '下颌松开',
  '念头经过，不去追',
  '听见此刻最远的声音',
  '感觉脚底和地面',
  '呼气比吸气长一点',
  '不需要做对什么',
  '手是暖的还是凉的',
  '什么都不用记住',
  '回到这一次呼吸',
]

const fg = cssVar('--fg')
const fg3 = cssVar('--fg-3')
const reduce = matchMedia('(prefers-reduced-motion: reduce)')
let rise = 0

const feed = createCylinderFeed<Breath>(document.getElementById('stage')!, {
  theme: { base: 'warm', card: 'transparent', shadows: [], border: 'transparent' },
  layout: { itemHeight: 56, gap: 8 },
  // 比默认慢得多的弹簧，接近临界阻尼，不回弹
  motion: { spring: { stiffness: 60, damping: 15 }, inertia: false },
  tilt: false,
  maxItems: 9,
  ariaLabel: '呼吸练习',
  renderItem(ctx, box) {
    const { item, index, x, y, width, layout } = box
    const cx = x + width / 2
    // 旧的句子退到后面，越早越淡
    ctx.globalAlpha *= index === 0 ? 1 : Math.max(0.16, 0.6 - (index - 1) * 0.08)
    ctx.translate(0, -rise)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fg
    ctx.font = `15px ${layout.font}`
    ctx.fillText(item.title, cx, y + 22)
    ctx.fillStyle = fg3
    ctx.font = `11px ${layout.font}`
    ctx.fillText(`第 ${item.n} 次`, cx, y + 42)
  },
})

const lineEl = document.querySelector<HTMLElement>('.guide-line')!
const label = document.querySelector<HTMLElement>('.guide-label')!
const meta = document.getElementById('meta')!
const smooth = (t: number) => t * t * (3 - 2 * t)

const start = performance.now()
let lastCycle = -1
let lastLabel = ''
const tick = (now: number) => {
  requestAnimationFrame(tick)
  const t = now - start
  const cycle = Math.floor(t / CYCLE)
  const p = t - cycle * CYCLE
  const inhale = p < INHALE
  const v = inhale ? smooth(p / INHALE) : 1 - smooth((p - INHALE) / (CYCLE - INHALE))

  if (cycle !== lastCycle) {
    lastCycle = cycle
    feed.push({ title: LINES[cycle % LINES.length], n: cycle + 1 })
    meta.textContent = `第 ${cycle + 1} 次呼吸 · 每分钟 6 次`
  }
  const left = Math.ceil(((inhale ? INHALE : CYCLE) - p) / 1000)
  const text = `${inhale ? '吸气' : '呼气'} ${left}`
  if (text !== lastLabel) label.textContent = lastLabel = text

  const still = reduce.matches
  lineEl.style.transform = `scaleX(${still ? 1 : 0.12 + 0.88 * v})`
  const nextRise = still ? 0 : v * RISE
  // 起伏画在 renderItem 里，不占用滚动，用户照样能滚
  if (Math.abs(nextRise - rise) > 0.05) {
    rise = nextRise
    feed.redraw()
  }
}
requestAnimationFrame(tick)
