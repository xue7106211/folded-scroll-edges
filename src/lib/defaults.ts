import type {
  AutoplayOptions,
  CylinderOptions,
  FeedItem,
  FeedLayout,
  FeedTheme,
  MotionOptions,
  ThemeInput,
  ThemePreset,
  TiltOptions,
} from './types'

// 次要色和弱化色都按各自卡面算过，对比度不低于 4.5:1
export const themes: Record<ThemePreset, FeedTheme> = {
  dark: {
    card: 'rgb(255 255 255 / 0.02)',
    cardGlow: 'rgb(255 255 255 / 0.12)',
    border: 'rgb(255 255 255 / 0.1)',
    // 纯白在深色底上会发散，主色降到 92%
    text: 'rgb(255 255 255 / 0.92)',
    secondary: 'rgb(255 255 255 / 0.62)',
    muted: 'rgb(255 255 255 / 0.5)',
    hover: 'rgb(255 255 255 / 0.04)',
    glyph: '#fff',
    tile: '#3a3a3c',
  },
  light: {
    card: '#fff',
    border: 'rgb(0 0 0 / 0.03)',
    shadows: [
      { y: 12, blur: 24, color: 'rgb(0 0 0 / 0.05)' },
      { y: 2, blur: 4, color: 'rgb(0 0 0 / 0.05)' },
    ],
    text: 'rgb(0 0 0 / 0.88)',
    secondary: 'rgb(0 0 0 / 0.64)',
    muted: 'rgb(0 0 0 / 0.55)',
    hover: 'rgb(0 0 0 / 0.025)',
    glyph: '#fff',
    tile: '#5c5c5c',
  },
  // 背景是照片或彩色时用：半透明卡片会让字落在杂色上，所以是实色卡面
  warm: {
    card: '#1c1a18',
    border: 'rgb(239 233 222 / 0.08)',
    shadows: [{ y: 8, blur: 24, color: 'rgb(0 0 0 / 0.35)' }],
    text: '#efe9de',
    secondary: '#aaa398',
    muted: '#8a847a',
    hover: 'rgb(239 233 222 / 0.05)',
    glyph: '#fff',
    tile: '#4a453f',
  },
}

export function resolveTheme(input: ThemeInput | undefined): FeedTheme {
  if (!input) return themes.dark
  if (typeof input === 'string') return themes[input] ?? themes.dark
  const { base = 'dark', ...rest } = input
  return { ...themes[base], ...rest }
}

// 14 / 12 / 11 是中文产品常用的字号层级，间距走 4px 栅格
export const defaultLayout: FeedLayout = {
  cardMaxWidth: 360,
  itemHeight: 64,
  gap: 8,
  radius: 16,
  paddingX: 16,
  sidePadding: 8,
  minWidth: 300,
  font: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif',
  titleSize: 14,
  descriptionSize: 12,
  timeSize: 11,
  iconSize: 32,
  iconRadius: 8,
}

export const defaultCylinder: CylinderOptions = {
  arc: 128,
  fov: 70.6,
  feather: 0.22,
  shadeMin: 0.18,
  edgeFade: 0.14,
  maxDpr: 2,
}

// wheelSpeed / dragSpeed 由旧版“弧度 × 170”的手感换算而来
export const defaultMotion: MotionOptions = {
  reducedMotion: 'auto',
  spring: { stiffness: 350, damping: 40 },
  inertia: true,
  wheelSpeed: 0.714,
  dragSpeed: 0.82,
}

export const defaultTilt: TiltOptions = {
  yaw: 3,
  pitch: 2,
  pull: 0.012,
  smoothing: 0.16,
}

export const defaultAutoplay: Required<Pick<AutoplayOptions<FeedItem>, 'interval'>> = {
  interval: 1000,
}
