// 公共类型：这是对外契约，改动字段名或默认值都算破坏性变更

/** SVG path 图标。duotone 是 20% 透明度的底色层（Phosphor duotone 的结构），可省略 */
export interface FeedIcon {
  path: string
  duotone?: string
  /** 正方形 viewBox 边长，默认 256（Phosphor） */
  viewBox?: number
}

export interface FeedItem {
  /** 业务主键，只透传给事件，组件内部不依赖 */
  id?: string | number
  title: string
  description?: string
  /** 标题后的弱化元信息，如“2 分钟前” */
  time?: string
  icon?: FeedIcon
  /** 图标底块颜色，缺省用主题的 tile */
  color?: string
}

export interface FeedTheme {
  /** 卡面填充 */
  card: string
  /** 卡片底部向上渐隐的内高光（Magic UI 深色款），不填则纯色卡面 */
  cardGlow?: string
  border: string
  /** 多层投影，单位是内容 px，会随缩放自动换算 */
  shadows?: { y: number; blur: number; color: string }[]
  text: string
  secondary: string
  muted: string
  /** 悬停时叠在卡面上的颜色 */
  hover: string
  /** 图标线条色 */
  glyph: string
  /** 没有 item.color 时的图标底块色 */
  tile: string
}

export type ThemePreset = 'dark' | 'light' | 'warm'
/** 预设名，或在某个预设上覆盖部分字段 */
export type ThemeInput = ThemePreset | (Partial<FeedTheme> & { base?: ThemePreset })

/** 尺寸单位都是“内容 px”：圆柱正面上 1 内容 px ≈ 1 屏幕 CSS px */
export interface FeedLayout {
  cardMaxWidth: number
  /** 卡片高度。自定义 renderItem 需要更高的卡片时改这里 */
  itemHeight: number
  gap: number
  radius: number
  /** 卡片内左右留白 */
  paddingX: number
  /** 卡片到面板边缘的最小距离 */
  sidePadding: number
  /** 面板窄于这个宽度时整体等比缩小，而不是继续挤压卡片 */
  minWidth: number
  font: string
  titleSize: number
  descriptionSize: number
  timeSize: number
  iconSize: number
  iconRadius: number
}

export interface CylinderOptions {
  /** 面板沿圆柱展开的角度（度）。越大上下卷得越明显 */
  arc: number
  /** 垂直视角（度） */
  fov: number
  /** 面板上下边缘的羽化比例，0–0.4 */
  feather: number
  /** 卷到背面时最暗的亮度，0–1 */
  shadeMin: number
  /** 容器上下用 CSS mask 渐隐的比例，0 关闭 */
  edgeFade: number
  /** 设备像素比上限，控制纹理和画布分辨率 */
  maxDpr: number
}

export interface MotionOptions {
  /** 'auto' 跟随系统的 prefers-reduced-motion */
  reducedMotion: 'auto' | boolean
  /** 入场与位移的弹簧，默认与 Magic UI Animated List 相同 */
  spring: { stiffness: number; damping: number }
  /** 松手或滚轮后的惯性 */
  inertia: boolean
  /** 1 个滚轮 delta 对应的内容 px */
  wheelSpeed: number
  /** 拖拽 1 屏幕 px 对应的内容 px */
  dragSpeed: number
}

export interface TiltOptions {
  /** 左右最大偏转（度） */
  yaw: number
  /** 上下最大偏转（度） */
  pitch: number
  /** 朝光标的平移，按面板宽度的比例 */
  pull: number
  /** 跟随的时间常数（秒），越大越“黏” */
  smoothing: number
}

export interface AutoplayOptions<T extends FeedItem = FeedItem> {
  /** 两次插入的间隔（毫秒） */
  interval: number
  /** 返回下一条要插入的数据；缺省时循环 items 初始传入的列表 */
  next?: (count: number) => T
}

export interface ItemBox<T extends FeedItem = FeedItem> {
  item: T
  index: number
  /** 卡片在内容坐标里的位置；ctx 已经套好滚动、入场缩放和透明度 */
  x: number
  y: number
  width: number
  height: number
  hovered: boolean
  theme: FeedTheme
  layout: FeedLayout
}

/** 自绘卡片。调用 drawDefault() 先画内置卡片，再叠加自己的内容 */
export type RenderItem<T extends FeedItem = FeedItem> = (
  ctx: CanvasRenderingContext2D,
  box: ItemBox<T>,
  drawDefault: () => void,
) => void

export interface CylinderFeedOptions<T extends FeedItem = FeedItem> {
  items?: T[]
  theme?: ThemeInput
  layout?: Partial<FeedLayout>
  cylinder?: Partial<CylinderOptions>
  motion?: Partial<MotionOptions>
  /** 悬停倾斜，false 关闭 */
  tilt?: Partial<TiltOptions> | false
  /** 定时在顶部插入新条目，false 关闭 */
  autoplay?: Partial<AutoplayOptions<T>> | false
  /** 超出后丢弃最早的条目 */
  maxItems?: number
  renderItem?: RenderItem<T>
  /** 容器的无障碍名称 */
  ariaLabel?: string
}

/** 创建后可以热更新的配置；cylinder 只在创建时生效 */
export type LiveOptions<T extends FeedItem = FeedItem> = Omit<CylinderFeedOptions<T>, 'items' | 'cylinder'>

export interface CylinderFeedEventMap<T extends FeedItem = FeedItem> {
  itemclick: { item: T; index: number; originalEvent: PointerEvent }
  itemhover: { item: T | null; index: number }
  scroll: { scroll: number; maxScroll: number }
}

export interface CylinderFeed<T extends FeedItem = FeedItem> {
  /** 传入的容器 */
  readonly element: HTMLElement
  /** false 表示浏览器不支持 WebGL2，已退回 DOM 列表 */
  readonly supported: boolean
  /** 在顶部插入一条，带入场动画 */
  push(item: T): void
  /** 整体替换，不播放动画 */
  setItems(items: T[]): void
  getItems(): readonly T[]
  setTheme(theme: ThemeInput): void
  setOptions(options: LiveOptions<T>): void
  scrollTo(scroll: number, options?: { animate?: boolean }): void
  getScroll(): number
  getMaxScroll(): number
  /** 当前正面中央的条目下标，没有条目时为 -1 */
  getCenterIndex(): number
  /** 开始或继续自动插入 */
  play(): void
  pause(): void
  on<K extends keyof CylinderFeedEventMap<T>>(type: K, listener: (e: CylinderFeedEventMap<T>[K]) => void): () => void
  /** 释放 GL 资源、监听和 DOM；之后实例不可再用 */
  destroy(): void
}
