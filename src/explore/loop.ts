// 节气：二十四节气绕成一整圈，今天所在的节气停在正面
import { createCylinderFeed, type FeedItem } from '../lib'
import { cssVar, mountNav, SERIF } from './nav'

mountNav('loop')

interface Term extends FeedItem {
  m: number
  d: number
  season: number
}

// 日期取常见年份的近似值，每个节气配七十二候里的初候
const TERMS: [string, number, number, string][] = [
  ['立春', 2, 4, '东风解冻'], ['雨水', 2, 19, '獭祭鱼'], ['惊蛰', 3, 5, '桃始华'],
  ['春分', 3, 20, '玄鸟至'], ['清明', 4, 4, '桐始华'], ['谷雨', 4, 20, '萍始生'],
  ['立夏', 5, 5, '蝼蝈鸣'], ['小满', 5, 21, '苦菜秀'], ['芒种', 6, 5, '螳螂生'],
  ['夏至', 6, 21, '鹿角解'], ['小暑', 7, 7, '温风至'], ['大暑', 7, 22, '腐草为萤'],
  ['立秋', 8, 7, '凉风至'], ['处暑', 8, 23, '鹰乃祭鸟'], ['白露', 9, 7, '鸿雁来'],
  ['秋分', 9, 23, '雷始收声'], ['寒露', 10, 8, '鸿雁来宾'], ['霜降', 10, 23, '豺乃祭兽'],
  ['立冬', 11, 7, '水始冰'], ['小雪', 11, 22, '虹藏不见'], ['大雪', 12, 7, '鹖鴠不鸣'],
  ['冬至', 12, 21, '蚯蚓结'], ['小寒', 1, 5, '雁北乡'], ['大寒', 1, 20, '鸡始乳'],
]
// 春夏秋冬各一个压暗的点色
const SEASON = ['#6f9a5c', '#c2452d', '#b8862c', '#5b78a8']

const items: Term[] = TERMS.map(([title, m, d, description], i) => ({
  title,
  description,
  time: `${m} 月 ${d} 日`,
  m,
  d,
  season: Math.floor(i / 6),
}))

const DAY = 86_400_000
const today = new Date()
today.setHours(0, 0, 0, 0)
const y = today.getFullYear()
/** 节气在 year 年的日期，晚于今天就往前推一年，得到最近一次开始的日子 */
const lastStart = (t: Term) => {
  const s = new Date(y, t.m - 1, t.d)
  return s > today ? new Date(y - 1, t.m - 1, t.d) : s
}
let cur = 0
items.forEach((t, i) => {
  if (lastStart(t) > lastStart(items[cur])) cur = i
})
const next = items[(cur + 1) % items.length]
let nextStart = new Date(y, next.m - 1, next.d)
if (nextStart <= today) nextStart = new Date(y + 1, next.m - 1, next.d)
const dayN = Math.round((+today - +lastStart(items[cur])) / DAY) + 1
const toNext = Math.round((+nextStart - +today) / DAY)

const fg = cssVar('--fg')
const fg2 = cssVar('--fg-2')
const fg3 = cssVar('--fg-3')
const line = cssVar('--line')
const mark = cssVar('--mark')

const feed = createCylinderFeed<Term>(document.getElementById('stage')!, {
  items,
  cylinder: { loop: true, edgeFade: 0.1 },
  layout: { itemHeight: 76, gap: 8 },
  ariaLabel: '二十四节气',
  renderItem(ctx, box) {
    const { item, index, x, y: top, width: w, height: h, hovered, layout } = box
    const now = index === cur
    ctx.beginPath()
    ctx.roundRect(x, top, w, h, layout.radius)
    ctx.fillStyle = hovered ? '#1a1d22' : '#15171b'
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = now ? mark : line
    ctx.beginPath()
    ctx.roundRect(x + 0.5, top + 0.5, w - 1, h - 1, layout.radius - 0.5)
    ctx.stroke()

    ctx.fillStyle = SEASON[item.season]
    ctx.beginPath()
    ctx.arc(x + 20, top + 28, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = fg
    ctx.font = `500 20px ${SERIF}`
    ctx.fillText(item.title, x + 32, top + 28)
    ctx.fillStyle = fg2
    ctx.font = `12px ${layout.font}`
    ctx.fillText(item.description ?? '', x + 32, top + 54)
    ctx.textAlign = 'right'
    ctx.fillStyle = fg3
    ctx.fillText(item.time ?? '', x + w - 16, top + 28)
    if (now) {
      ctx.fillStyle = mark
      ctx.fillText('此刻', x + w - 16, top + 54)
    }
  },
})
feed.scrollToIndex(cur, { animate: false })
feed.on('itemclick', ({ index }) => feed.scrollToIndex(index))

const meta = document.getElementById('meta')!
meta.textContent = `${today.getMonth() + 1} 月 ${today.getDate()} 日 · ${items[cur].title}第 ${dayN} 天 · 距${next.title} ${toNext} 天`
const back = document.createElement('button')
back.type = 'button'
back.textContent = '回到此刻'
back.addEventListener('click', () => feed.scrollToIndex(cur))
meta.append(back)
