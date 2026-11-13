// 手卷：《春江花月夜》一联一行卷在圆柱上，一次只展开一段。只通过公开 API 使用组件
import { createCylinderFeed, type CylinderFeed, type FeedItem } from './lib'

interface Line extends FeedItem {
  kind: 'title' | 'line' | 'end'
}

// 张若虚《春江花月夜》，一联一行
const POEM = [
  '春江潮水连海平，海上明月共潮生。',
  '滟滟随波千万里，何处春江无月明！',
  '江流宛转绕芳甸，月照花林皆似霰。',
  '空里流霜不觉飞，汀上白沙看不见。',
  '江天一色无纤尘，皎皎空中孤月轮。',
  '江畔何人初见月？江月何年初照人？',
  '人生代代无穷已，江月年年望相似。',
  '不知江月待何人，但见长江送流水。',
  '白云一片去悠悠，青枫浦上不胜愁。',
  '谁家今夜扁舟子？何处相思明月楼？',
  '可怜楼上月徘徊，应照离人妆镜台。',
  '玉户帘中卷不去，捣衣砧上拂还来。',
  '此时相望不相闻，愿逐月华流照君。',
  '鸿雁长飞光不度，鱼龙潜跃水成文。',
  '昨夜闲潭梦落花，可怜春半不还家。',
  '江水流春去欲尽，江潭落月复西斜。',
  '斜月沉沉藏海雾，碣石潇湘无限路。',
  '不知乘月几人归，落月摇情满江树。',
]

const ITEMS: Line[] = [
  { kind: 'title', title: '春江花月夜', description: '张若虚 · 唐' },
  ...POEM.map((title) => ({ kind: 'line' as const, title })),
  { kind: 'end', title: '终' },
]

// 生宣纸上的墨色和朱印；纸色本身在 style.css 的 html[data-view='scroll']
const INK = '#2a2622'
const INK_MUTED = '#756c61'
const SEAL = '#a8321e'
const SERIF = '"Songti SC", "Noto Serif SC", STSong, SimSun, serif'

export function mountScroll(container: HTMLElement, meta: HTMLElement): CylinderFeed<Line> {
  const feed = createCylinderFeed<Line>(container, {
    items: ITEMS,
    theme: { base: 'light', card: 'transparent', border: 'transparent', shadows: [], text: INK, secondary: INK_MUTED, muted: INK_MUTED },
    layout: { font: SERIF, itemHeight: 56, gap: 0, titleSize: 17 },
    cylinder: { arc: 110, feather: 0.26, edgeFade: 0.16 },
    // 纸有分量：滚得慢一些，悬停几乎不动
    motion: { wheelSpeed: 0.42, dragSpeed: 0.7 },
    tilt: { yaw: 1.5, pitch: 1, pull: 0.006, smoothing: 0.4 },
    ariaLabel: '春江花月夜，张若虚',
    renderItem(ctx, box) {
      const { item, x, y, width, height, layout } = box
      const cx = x + width / 2
      const cy = y + height / 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (item.kind === 'title') {
        ctx.fillStyle = INK
        ctx.font = `500 22px ${layout.font}`
        ctx.fillText(item.title, cx, cy - 8)
        ctx.fillStyle = INK_MUTED
        ctx.font = `12px ${layout.font}`
        ctx.fillText(item.description ?? '', cx, cy + 18)
      } else if (item.kind === 'end') {
        // 卷尾的朱印
        const S = 28
        ctx.fillStyle = SEAL
        ctx.beginPath()
        ctx.roundRect(cx - S / 2, cy - S / 2, S, S, 4)
        ctx.fill()
        ctx.fillStyle = '#f6efe2'
        ctx.font = `500 15px ${layout.font}`
        ctx.fillText(item.title, cx, cy + 1)
      } else {
        ctx.fillStyle = INK
        ctx.font = `${layout.titleSize}px ${layout.font}`
        ctx.fillText(item.title, cx, cy)
      }
    },
  })

  const showProgress = () => {
    const i = feed.getCenterIndex()
    meta.textContent = i <= 0 ? `共 ${POEM.length} 联` : i > POEM.length ? '卷终' : `第 ${i} / ${POEM.length} 联`
  }
  feed.on('scroll', showProgress)
  showProgress()
  return feed
}
