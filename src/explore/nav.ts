// 探索页共用的顶部导航
import './explore.css'

const PAGES = [
  ['scroll', '手卷'],
  ['decay', '无常'],
  ['loop', '节气'],
  ['breath', '呼吸'],
] as const

export function mountNav(current: (typeof PAGES)[number][0]) {
  const nav = document.createElement('nav')
  nav.className = 'nav'
  nav.setAttribute('aria-label', '探索')
  const home = document.createElement('a')
  home.href = '../'
  home.textContent = '通知列表'
  const sep = document.createElement('span')
  sep.className = 'sep'
  sep.setAttribute('aria-hidden', 'true')
  nav.append(home, sep)
  for (const [id, label] of PAGES) {
    const a = document.createElement('a')
    a.href = `./${id}.html`
    a.textContent = label
    if (id === current) a.setAttribute('aria-current', 'page')
    nav.append(a)
  }
  document.body.prepend(nav)
}

/** canvas 不认 CSS 变量，绘制前先读成具体颜色 */
export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const SERIF = '"Songti SC", "Noto Serif SC", STSong, SimSun, serif'
