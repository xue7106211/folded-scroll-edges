import { createCylinderFeed } from './core'
import type { CylinderFeed, CylinderFeedOptions, FeedItem, ThemeInput, ThemePreset } from './types'

export interface CylinderFeedElement<T extends FeedItem = FeedItem> extends HTMLElement {
  items: T[]
  /** 创建时的完整配置；连接到文档后再赋值只会应用可热更新的部分 */
  options: CylinderFeedOptions<T>
  theme: ThemeInput
  /** 当前实例，未连接到文档时为 null */
  readonly feed: CylinderFeed<T> | null
  push(item: T): void
  /** 滚到指定的内容 px。不叫 scrollTo，避免覆盖 DOM 原生的 Element.scrollTo */
  scrollToOffset(scroll: number, options?: { animate?: boolean }): void
  play(): void
  pause(): void
}

const PRESETS: ThemePreset[] = ['dark', 'light', 'warm']

/**
 * 注册 <cylinder-feed>。放在函数里而不是模块顶层：SSR 环境没有 HTMLElement，导入也不该有副作用
 *
 * 属性：theme、autoplay、interval、tilt="off"、reduced-motion="auto|true|false"、label
 * 事件：itemclick、itemhover、feedscroll（CustomEvent，数据在 detail 里，会冒泡并穿出 shadow DOM）
 */
export function defineCylinderFeed(tagName = 'cylinder-feed') {
  if (typeof customElements === 'undefined') return
  const existing = customElements.get(tagName)
  if (existing) return existing

  class Element extends HTMLElement implements CylinderFeedElement {
    static observedAttributes = ['theme', 'autoplay', 'interval', 'tilt', 'reduced-motion', 'label']
    #feed: CylinderFeed | null = null
    #items: FeedItem[] = []
    #options: CylinderFeedOptions = {}
    #root: HTMLDivElement

    constructor() {
      super()
      const shadow = this.attachShadow({ mode: 'open' })
      shadow.innerHTML =
        '<style>:host{display:block;position:relative;min-height:320px}:host([hidden]){display:none}' +
        '.root{position:absolute;inset:0;outline:none}.root:focus-visible{outline:2px solid currentColor;outline-offset:-2px}</style>'
      this.#root = document.createElement('div')
      this.#root.className = 'root'
      shadow.append(this.#root)
    }

    get feed() {
      return this.#feed
    }
    get items() {
      return this.#feed ? [...this.#feed.getItems()] : this.#items
    }
    set items(v) {
      this.#items = v
      this.#feed?.setItems(v)
    }
    get options() {
      return this.#options
    }
    set options(v) {
      this.#options = v
      if (this.#feed) {
        const { items: _items, cylinder: _cylinder, ...live } = v
        this.#feed.setOptions(live)
      }
    }
    get theme(): ThemeInput {
      return this.#attrOptions().theme ?? this.#options.theme ?? 'dark'
    }
    set theme(v) {
      if (typeof v === 'string') this.setAttribute('theme', v)
      else {
        this.#options = { ...this.#options, theme: v }
        this.#feed?.setTheme(v)
      }
    }

    push(item: FeedItem) {
      if (this.#feed) this.#feed.push(item)
      else this.#items = [item, ...this.#items]
    }
    scrollToOffset(scroll: number, options?: { animate?: boolean }) {
      this.#feed?.scrollTo(scroll, options)
    }
    play() {
      this.#feed?.play()
    }
    pause() {
      this.#feed?.pause()
    }

    #attrOptions(): CylinderFeedOptions {
      const o: CylinderFeedOptions = {}
      const theme = this.getAttribute('theme') as ThemePreset | null
      if (theme && PRESETS.includes(theme)) o.theme = theme
      if (this.hasAttribute('autoplay')) {
        const interval = Number(this.getAttribute('interval'))
        o.autoplay = interval > 0 ? { interval } : {}
      } else if (this.hasAttribute('interval')) o.autoplay = false
      const tilt = this.getAttribute('tilt')
      if (tilt === 'off' || tilt === 'false') o.tilt = false
      const rm = this.getAttribute('reduced-motion')
      if (rm === 'true' || rm === 'false') o.motion = { reducedMotion: rm === 'true' }
      const label = this.getAttribute('label')
      if (label) o.ariaLabel = label
      return o
    }

    connectedCallback() {
      if (this.#feed) return
      const attrs = this.#attrOptions()
      const opts: CylinderFeedOptions = {
        ...this.#options,
        ...attrs,
        motion: { ...this.#options.motion, ...attrs.motion },
        items: this.#items,
      }
      if (!('autoplay' in attrs)) opts.autoplay = this.#options.autoplay ?? false
      const feed = createCylinderFeed(this.#root, opts)
      const relay = (type: string) => (detail: unknown) =>
        this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
      feed.on('itemclick', relay('itemclick'))
      feed.on('itemhover', relay('itemhover'))
      feed.on('scroll', relay('feedscroll'))
      this.#feed = feed
    }

    disconnectedCallback() {
      // 移动节点也会触发；留住数据，重新连接时原样恢复
      if (!this.#feed) return
      this.#items = [...this.#feed.getItems()]
      this.#feed.destroy()
      this.#feed = null
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
      if (!this.#feed || oldValue === newValue) return
      const attrs = this.#attrOptions()
      // 只下发变了的那一项：autoplay 一旦下发就会重置播放状态，改主题不能连带打断 pause() / play()
      switch (name) {
        case 'theme':
          this.#feed.setTheme(attrs.theme ?? this.#options.theme ?? 'dark')
          break
        case 'tilt':
          this.#feed.setOptions({ tilt: attrs.tilt ?? this.#options.tilt ?? {} })
          break
        case 'autoplay':
        case 'interval':
          this.#feed.setOptions({ autoplay: attrs.autoplay ?? this.#options.autoplay ?? false })
          break
        case 'reduced-motion':
          this.#feed.setOptions({
            motion: { reducedMotion: attrs.motion?.reducedMotion ?? this.#options.motion?.reducedMotion ?? 'auto' },
          })
          break
        case 'label':
          this.#feed.setOptions({ ariaLabel: attrs.ariaLabel ?? this.#options.ariaLabel ?? '通知列表' })
          break
      }
    }
  }

  customElements.define(tagName, Element)
  return Element
}
