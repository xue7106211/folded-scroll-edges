// 演示页（playground）：只通过公开 API 使用组件，同时也是接入示例
import './style.css'
import {
  createCylinderFeed,
  defaultCylinder,
  defaultLayout,
  defaultMotion,
  defaultTilt,
  icons,
  type CylinderFeed,
  type CylinderFeedOptions,
  type FeedItem,
  type LiveOptions,
  type ThemePreset,
} from './lib'
import { createPanel, type Group } from './panel'
import { mountScroll } from './scroll'

type View = 'feed' | 'scroll'

// 底块是一组压暗的印刷色卡色，白色图形在每块上的对比度都 ≥ 3.8:1
// 新条目插在顶部、按数组顺序循环，所以从旧到新排，列表从上往下读才是越来越早
const NOTICES: FeedItem[] = [
  { title: '许诺在讨论中提到了你', description: '看下图标风格是否统一', time: '30 分钟前', icon: icons.mention, color: '#9E3F5C' },
  { title: '设计评审已通过', description: '会员中心改版，由王蕾确认', time: '20 分钟前', icon: icons.approve, color: '#4F7A43' },
  { title: '周宁更新了组件库', description: '按钮、输入框等 12 个组件有改动', time: '15 分钟前', icon: icons.edit, color: '#3A7480' },
  { title: '陈默邀请你加入项目', description: '品牌升级 2027 · 可编辑', time: '10 分钟前', icon: icons.invite, color: '#A87A1E' },
  { title: '首页改版 v3 已发布', description: '已同步到「品牌官网」团队库', time: '5 分钟前', icon: icons.launch, color: '#C2452D' },
  { title: '林晓评论了设计稿', description: '首页改版第 3 页：按钮间距再大一点', time: '2 分钟前', icon: icons.comment, color: '#2F5FB3' },
]

// 深浅色跟随系统
const lightQuery = matchMedia('(prefers-color-scheme: light)')
const feedTheme = (): ThemePreset => (lightQuery.matches ? 'light' : 'dark')

// 序号放在实例外面，重建实例后插入顺序接得上
let seq = 0
const nextNotice = () => NOTICES[seq++ % NOTICES.length]
// 预填 20 条：从数组末尾往前循环，让顶部正好接上自动插入的下一条
const prefill = Array.from({ length: 20 }, (_, i) => NOTICES[(NOTICES.length * 4 - 1 - i) % NOTICES.length])

// ---- 面板状态 ----
const DEFAULTS = {
  tiltOn: true,
  yaw: defaultTilt.yaw,
  pitch: defaultTilt.pitch,
  pull: defaultTilt.pull,
  smoothing: defaultTilt.smoothing,
  stiffness: defaultMotion.spring.stiffness,
  damping: defaultMotion.spring.damping,
  inertia: defaultMotion.inertia,
  wheelSpeed: defaultMotion.wheelSpeed,
  dragSpeed: defaultMotion.dragSpeed,
  autoplayOn: true,
  interval: 1000,
  cardMaxWidth: defaultLayout.cardMaxWidth,
  itemHeight: defaultLayout.itemHeight,
  gap: defaultLayout.gap,
  radius: defaultLayout.radius,
  arc: defaultCylinder.arc,
  fov: defaultCylinder.fov,
  feather: defaultCylinder.feather,
  edgeFade: defaultCylinder.edgeFade,
}
type State = typeof DEFAULTS
type Key = keyof State
type Section = 'tilt' | 'motion' | 'autoplay' | 'layout' | 'cylinder'
const state: State = { ...DEFAULTS }

// 时间统一用 ms，比例统一用 %，倍率用 ×，让数值一眼能读出含义
const ms = (v: number) => `${Math.round(v * 1000)}ms`
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
const times = (v: number) => `${v.toFixed(2)}×`

const GROUPS = [
  {
    section: 'tilt',
    title: '悬停倾斜',
    switchKey: 'tiltOn',
    controls: [
      { key: 'yaw', label: '左右偏转', min: 0, max: 8, step: 0.5, unit: '°' },
      { key: 'pitch', label: '上下偏转', min: 0, max: 8, step: 0.5, unit: '°' },
      { key: 'pull', label: '吸附位移', min: 0, max: 0.04, step: 0.002, format: pct },
      { key: 'smoothing', label: '跟随延迟', min: 0.04, max: 0.6, step: 0.02, format: ms },
    ],
  },
  {
    section: 'motion',
    title: '入场弹簧',
    controls: [
      { key: 'stiffness', label: '刚度', min: 50, max: 800, step: 10 },
      { key: 'damping', label: '阻尼', min: 5, max: 80, step: 1 },
    ],
  },
  {
    section: 'motion',
    title: '滚动',
    controls: [
      { key: 'inertia', label: '惯性', toggle: true },
      // 步进要能落在库的默认值 0.714 / 0.82 上，否则拖回原位也对不上默认值
      { key: 'wheelSpeed', label: '滚轮速度', min: 0.2, max: 2, step: 0.001, format: times },
      { key: 'dragSpeed', label: '拖拽速度', min: 0.2, max: 2, step: 0.001, format: times },
    ],
  },
  {
    section: 'autoplay',
    title: '自动插入',
    switchKey: 'autoplayOn',
    controls: [{ key: 'interval', label: '间隔', min: 300, max: 4000, step: 100, unit: 'ms' }],
  },
  {
    section: 'layout',
    title: '卡片',
    controls: [
      { key: 'cardMaxWidth', label: '最大宽度', min: 240, max: 480, step: 8, unit: 'px' },
      { key: 'itemHeight', label: '高度', min: 56, max: 96, step: 4, unit: 'px' },
      { key: 'gap', label: '间距', min: 0, max: 24, step: 4, unit: 'px' },
      { key: 'radius', label: '圆角', min: 0, max: 24, step: 2, unit: 'px' },
    ],
  },
  {
    section: 'cylinder',
    title: '圆柱',
    note: '创建时固定，松手后重建实例',
    controls: [
      { key: 'arc', label: '展开角度', min: 60, max: 180, step: 2, unit: '°' },
      { key: 'fov', label: '视角', min: 40, max: 100, step: 0.2, unit: '°' },
      { key: 'feather', label: '面板羽化', min: 0, max: 0.4, step: 0.01, format: pct },
      { key: 'edgeFade', label: '容器渐隐', min: 0, max: 0.3, step: 0.01, format: pct },
    ],
  },
] satisfies (Group<Key> & { section: Section })[]

// 组标题上的总开关也要映射到所属配置段
const SECTION = Object.fromEntries(
  GROUPS.flatMap((g) => [...g.controls.map((c) => c.key), ...('switchKey' in g ? [g.switchKey] : [])].map((k) => [k, g.section])),
) as Record<Key, Section>
const pick = (keys: Key[]) => Object.fromEntries(keys.map((k) => [k, state[k]]))
const TILT: Key[] = ['yaw', 'pitch', 'pull', 'smoothing']
const SCROLL: Key[] = ['inertia', 'wheelSpeed', 'dragSpeed']
const LAYOUT: Key[] = ['cardMaxWidth', 'itemHeight', 'gap', 'radius']
const CYLINDER: Key[] = ['arc', 'fov', 'feather', 'edgeFade']

const options = () =>
  ({
    tilt: state.tiltOn ? pick(TILT) : false,
    motion: { spring: { stiffness: state.stiffness, damping: state.damping }, ...pick(SCROLL) },
    autoplay: state.autoplayOn ? { interval: state.interval, next: nextNotice } : false,
    layout: pick(LAYOUT),
    cylinder: pick(CYLINDER),
  }) as Required<Pick<CylinderFeedOptions, Section>>

// ---- 组件实例 ----
const app = document.getElementById('app')!
let feed: CylinderFeed

function mount(items: FeedItem[]) {
  feed = createCylinderFeed(app, { items, theme: feedTheme(), ariaLabel: '设计协作通知', ...options() })
  feed.on('itemclick', ({ item }) => console.info('[demo] itemclick', item.title))
  if (import.meta.env.DEV) Object.assign(window, { feed })
}

/** cylinder 的几何在创建时固定，改了只能销毁重建；保留当前条目和滚动位置 */
function rebuild() {
  const items = [...feed.getItems()]
  const scroll = feed.getScroll()
  feed.destroy()
  mount(items)
  feed.scrollTo(scroll, { animate: false })
}

mount(prefill)

// ---- 面板 ----
/** 只输出和默认值不同的字段，粘贴到业务代码里就能用 */
function snippet() {
  const changed = (keys: Key[]) => keys.filter((k) => state[k] !== DEFAULTS[k])
  const out: Record<string, unknown> = {}
  if (!state.tiltOn) out.tilt = false
  else if (changed(TILT).length) out.tilt = pick(changed(TILT))
  const spring = changed(['stiffness', 'damping'])
  const motion = { ...pick(changed(SCROLL)), ...(spring.length ? { spring: pick(spring) } : {}) }
  if (Object.keys(motion).length) out.motion = motion
  if (state.autoplayOn) out.autoplay = { interval: state.interval }
  if (changed(LAYOUT).length) out.layout = pick(changed(LAYOUT))
  if (changed(CYLINDER).length) out.cylinder = pick(changed(CYLINDER))
  return `createCylinderFeed(el, ${JSON.stringify({ items: '…', ...out }, null, 2)})`
}

// 原文字存在 dataset 里，连点时不会把“已复制”当成原文字记下来
const flashTimers = new WeakMap<HTMLButtonElement, number>()
const flash = (button: HTMLButtonElement, text: string) => {
  button.dataset.label ??= button.textContent ?? ''
  clearTimeout(flashTimers.get(button))
  button.textContent = text
  flashTimers.set(button, window.setTimeout(() => (button.textContent = button.dataset.label!), 1200))
}

const panel = createPanel<State>({
  groups: GROUPS,
  state,
  defaults: DEFAULTS,
  onChange(key, committed) {
    const section = SECTION[key]
    if (section === 'cylinder') {
      if (committed) rebuild()
      return
    }
    const o = options()
    const patch: LiveOptions = {}
    if (section === 'tilt') patch.tilt = o.tilt
    else if (section === 'motion') patch.motion = o.motion
    else if (section === 'autoplay') patch.autoplay = o.autoplay
    else patch.layout = o.layout
    feed.setOptions(patch)
  },
  actions: [
    { label: '推入一条', run: () => feed.push(nextNotice()) },
    { label: '回到顶部', run: () => feed.scrollTo(0) },
    {
      label: '恢复默认',
      variant: 'quiet',
      run: () => {
        Object.assign(state, DEFAULTS)
        panel.update()
        rebuild()
      },
    },
    {
      label: '复制配置',
      variant: 'primary',
      run: (b) => {
        const text = snippet()
        navigator.clipboard?.writeText(text).then(
          () => flash(b, '已复制'),
          () => (console.info(text), flash(b, '已输出到控制台')),
        ) ?? (console.info(text), flash(b, '已输出到控制台'))
      },
    },
  ],
})
document.body.append(panel.element)

// ---- 展示样式：通知 / 手卷 ----
// 两个实例各占一个容器，切走的那个 display: none，组件的 IntersectionObserver 会停掉它的渲染循环，
// 切回来时滚动位置和条目都还在。手卷第一次切过去才创建，不用的人不多开一个 GL 上下文
const isView = (v: unknown): v is View => v === 'feed' || v === 'scroll'
const savedView = localStorage.getItem('cyl-view')
let view: View = isView(savedView) ? savedView : 'feed'
const scrollEl = document.getElementById('scroll')!
let scrollFeed: ReturnType<typeof mountScroll> | null = null

const PAGE_COLORS = {
  feed: { dark: '#070707', light: '#eceae4' },
  scroll: { dark: '#171512', light: '#ece6d8' },
}
function syncThemeColor() {
  const color = PAGE_COLORS[view][feedTheme() === 'light' ? 'light' : 'dark']
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

function applyView(next: View) {
  view = next
  document.documentElement.dataset.view = next
  app.hidden = next !== 'feed'
  scrollEl.hidden = next !== 'scroll'
  if (next === 'scroll' && !scrollFeed) scrollFeed = mountScroll(scrollEl, document.getElementById('scroll-meta')!)
  document.querySelectorAll<HTMLButtonElement>('.dock [data-view]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === next))
  })
  syncThemeColor()
}

applyView(view)

document.querySelector('.dock')?.addEventListener('click', (e) => {
  const next = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]')?.dataset.view
  if (!isView(next) || next === view) return
  localStorage.setItem('cyl-view', next)
  applyView(next)
})

// 系统切换深浅色时，页面由 CSS 媒体查询处理，canvas 里的颜色要另外通知；手卷自己监听
lightQuery.addEventListener('change', () => {
  feed.setTheme(feedTheme())
  syncThemeColor()
})
