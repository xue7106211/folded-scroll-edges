// 无常：每条通知只停留一段时间，越来越淡，到期自己离开
import { createCylinderFeed, icons, type FeedItem } from '../lib'
import { mountNav } from './nav'

mountNav('decay')

interface Notice extends FeedItem {
  born: number
}

// 演示用的寿命很短，方便看到整个过程
const LIFETIME = 24_000
const INTERVAL = 3_000

const SOURCE: FeedItem[] = [
  { title: '林晓评论了设计稿', description: '首页改版第 3 页：按钮间距再大一点', icon: icons.comment, color: '#2F5FB3' },
  { title: '设计评审已通过', description: '会员中心改版，由王蕾确认', icon: icons.approve, color: '#4F7A43' },
  { title: '许诺在讨论中提到了你', description: '看下图标风格是否统一', icon: icons.mention, color: '#9E3F5C' },
  { title: '周宁更新了组件库', description: '按钮、输入框等 12 个组件有改动', icon: icons.edit, color: '#3A7480' },
  { title: '陈默邀请你加入项目', description: '品牌升级 2027 · 可编辑', icon: icons.invite, color: '#A87A1E' },
  { title: '首页改版 v3 已发布', description: '已同步到「品牌官网」团队库', icon: icons.launch, color: '#C2452D' },
  { title: '王蕾回复了你', description: '那就按第二版走', icon: icons.comment, color: '#2F5FB3' },
  { title: '周宁标记了 3 处待修改', description: '详情页 · 移动端', icon: icons.edit, color: '#3A7480' },
]

let made = 0
// 每次都是新对象，remove() 按引用找
const make = (born: number): Notice => ({ ...SOURCE[made % SOURCE.length], id: made++, born })
const life = (n: Notice, now: number) => Math.min(1, Math.max(0, (now - n.born) / LIFETIME))
const ago = (ms: number) => (ms < 3000 ? '刚刚' : `${Math.floor(ms / 1000)} 秒前`)

// 开场就有一串不同年龄的条目，新的在上
const t0 = performance.now()
const seed = Array.from({ length: 6 }, (_, i) => make(t0 - (i + 0.5) * INTERVAL))
seed.forEach((n) => (n.time = ago(t0 - n.born)))

const meta = document.getElementById('meta')!
const feed = createCylinderFeed<Notice>(document.getElementById('stage')!, {
  items: seed,
  autoplay: { interval: INTERVAL, next: () => ({ ...make(performance.now()), time: '刚刚' }) },
  ariaLabel: '会消散的通知',
  renderItem(ctx, box, drawDefault) {
    const a = life(box.item, performance.now())
    ctx.globalAlpha *= 0.06 + 0.94 * Math.pow(1 - a, 1.6)
    drawDefault()
    // 卡片底部一条细线，长度是剩下的时间
    const { x, y, width, height, theme, layout } = box
    ctx.fillStyle = theme.muted
    ctx.fillRect(x + layout.radius, y + height - 6, (width - layout.radius * 2) * (1 - a), 1)
  },
})

// 点一下就先放下，留 0.8 秒淡出
feed.on('itemclick', ({ item }) => {
  item.born = Math.min(item.born, performance.now() - LIFETIME + 800)
})

let gone = 0
let lastTick = 0
const tick = (now: number) => {
  requestAnimationFrame(tick)
  // 透明度变化很慢，10fps 足够，也省掉每帧上传纹理
  if (now - lastTick < 100) return
  lastTick = now
  for (const n of feed.getItems()) {
    const age = now - n.born
    if (age >= LIFETIME) {
      feed.remove(n)
      gone++
    } else n.time = ago(age)
  }
  feed.redraw()
  meta.textContent = `此刻 ${feed.getItems().length} 条 · 已离开 ${gone} 条`
}
requestAnimationFrame(tick)
