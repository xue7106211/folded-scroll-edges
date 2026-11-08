// 演示页的参数面板，只服务 demo，不属于组件库
type Value = number | boolean

export type Control<K extends string> =
  | { key: K; label: string; min: number; max: number; step: number; unit?: string; format?: (v: number) => string }
  | { key: K; label: string; toggle: true }

export interface Group<K extends string> {
  title: string
  note?: string
  /** 放在组标题右侧的总开关：关掉后组内其余控件置灰 */
  switchKey?: K
  controls: Control<K>[]
}

export interface Action {
  label: string
  variant?: 'primary' | 'secondary' | 'quiet'
  run: (button: HTMLButtonElement) => void
}

type View = { key: string; gate?: string; update: (off: boolean, changed: boolean) => void }

export function createPanel<S extends Record<string, Value>>(opts: {
  groups: Group<Extract<keyof S, string>>[]
  state: S
  /** 用来标记改动、单项恢复 */
  defaults: S
  /** 滑杆拖动中 committed 为 false，松手、开关切换或单项恢复时为 true */
  onChange: (key: Extract<keyof S, string>, committed: boolean) => void
  actions: Action[]
}) {
  type K = Extract<keyof S, string>
  const state = opts.state as Record<string, Value>
  const defaults = opts.defaults as Record<string, Value>
  const root = document.createElement('aside')
  root.className = 'panel'
  root.setAttribute('aria-label', '参数')

  const head = document.createElement('button')
  head.type = 'button'
  head.className = 'panel-head'
  head.setAttribute('aria-controls', 'panel-body')
  head.innerHTML =
    '<span>参数</span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  const body = document.createElement('div')
  body.className = 'panel-body'
  body.id = 'panel-body'
  const foot = document.createElement('div')
  foot.className = 'panel-foot'
  root.append(head, body, foot)

  const setOpen = (open: boolean) => {
    root.dataset.open = String(open)
    head.setAttribute('aria-expanded', String(open))
    localStorage.setItem('cyl-panel', open ? '1' : '0')
  }
  const saved = localStorage.getItem('cyl-panel')
  setOpen(saved ? saved === '1' : matchMedia('(min-width: 900px)').matches)
  head.addEventListener('click', () => setOpen(root.dataset.open !== 'true'))

  const views: View[] = []
  const sync: (() => void)[] = []
  const refresh = () => {
    for (const v of views) v.update(v.gate ? !state[v.gate] : false, state[v.key] !== defaults[v.key])
  }
  const commit = (key: K) => {
    refresh()
    opts.onChange(key, true)
  }
  const digits = (step: number) => (String(step).split('.')[1] ?? '').length
  const dot = () => {
    const d = document.createElement('span')
    d.className = 'panel-dot'
    d.setAttribute('aria-hidden', 'true')
    return d
  }
  const makeSwitch = (key: K, label: string, id?: string) => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'panel-switch'
    input.setAttribute('role', 'switch')
    if (id) input.id = id
    else input.setAttribute('aria-label', label)
    input.addEventListener('change', () => {
      state[key] = input.checked
      commit(key)
    })
    sync.push(() => (input.checked = Boolean(state[key])))
    const end = document.createElement('span')
    end.className = 'panel-end'
    end.append(dot(), input)
    return { input, end }
  }

  opts.groups.forEach((g, gi) => {
    const section = document.createElement('section')
    section.className = 'panel-group'
    section.setAttribute('role', 'group')
    const titleRow = document.createElement('div')
    titleRow.className = 'panel-group-head'
    const h = document.createElement('h3')
    h.id = `panel-g${gi}`
    h.textContent = g.title
    section.setAttribute('aria-labelledby', h.id)
    titleRow.append(h)
    if (g.switchKey) {
      const { input, end } = makeSwitch(g.switchKey, g.title, `ctl-${g.switchKey}`)
      input.setAttribute('aria-labelledby', h.id)
      titleRow.append(end)
      views.push({ key: g.switchKey, update: (_, changed) => end.classList.toggle('is-changed', changed) })
    }
    section.append(titleRow)
    if (g.note) {
      const p = document.createElement('p')
      p.className = 'panel-note'
      p.textContent = g.note
      section.append(p)
    }

    for (const c of g.controls) {
      const id = `ctl-${c.key}`
      const row = document.createElement('div')
      row.className = 'panel-row'
      const label = document.createElement('label')
      label.htmlFor = id
      label.textContent = c.label

      if ('toggle' in c) {
        row.classList.add('is-toggle')
        const { input, end } = makeSwitch(c.key, c.label, id)
        row.append(label, end)
        views.push({
          key: c.key,
          gate: g.switchKey,
          update(off, changed) {
            input.disabled = off
            row.classList.toggle('is-off', off)
            row.classList.toggle('is-changed', changed)
          },
        })
      } else {
        const input = document.createElement('input')
        input.type = 'range'
        input.id = id
        input.min = String(c.min)
        input.max = String(c.max)
        input.step = String(c.step)
        const fmt = (v: number) => c.format?.(v) ?? `${v.toFixed(digits(c.step))}${c.unit ?? ''}`
        const value = document.createElement('button')
        value.type = 'button'
        value.className = 'panel-value'
        const num = document.createElement('span')
        value.append(dot(), num)
        const show = () => {
          const v = Number(state[c.key])
          num.textContent = fmt(v)
          // 滑杆左侧填充色的比例，CSS 里用 --p 画轨道
          input.style.setProperty('--p', `${((v - c.min) / (c.max - c.min)) * 100}%`)
        }
        input.addEventListener('input', () => {
          state[c.key] = Number(input.value)
          show()
          refresh()
          opts.onChange(c.key, false)
        })
        input.addEventListener('change', () => opts.onChange(c.key, true))
        value.addEventListener('click', () => {
          if (state[c.key] === defaults[c.key]) return
          state[c.key] = defaults[c.key]
          input.value = String(state[c.key])
          show()
          commit(c.key)
        })
        sync.push(() => {
          input.value = String(state[c.key])
          show()
        })
        views.push({
          key: c.key,
          gate: g.switchKey,
          update(off, changed) {
            input.disabled = off
            value.disabled = off || !changed
            row.classList.toggle('is-off', off)
            row.classList.toggle('is-changed', changed)
            const now = fmt(Number(state[c.key]))
            value.title = changed ? `恢复默认值 ${fmt(Number(defaults[c.key]))}` : ''
            value.setAttribute('aria-label', changed ? `${c.label} ${now}，点击恢复默认值` : `${c.label} ${now}`)
          },
        })
        row.append(label, input, value)
      }
      section.append(row)
    }
    body.append(section)
  })

  for (const a of opts.actions) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `is-${a.variant ?? 'secondary'}`
    b.textContent = a.label
    b.addEventListener('click', () => a.run(b))
    foot.append(b)
  }

  const update = () => {
    sync.forEach((fn) => fn())
    refresh()
  }
  update()
  return { element: root, update }
}
