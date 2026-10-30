import data from './content.json'
type Exp = { company_zh: string; role_zh: string; period: string; highlights_zh?: string[] }
type Proj = { title_zh: string; summary_zh: string; tags?: string[]; links?: { label: string; url: string }[] }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export function buildList(): HTMLDivElement {
  const d = data as unknown as { profile: { name_zh: string; tagline_zh: string }; experience: Exp[]; projects: Proj[] }
  const el = document.createElement('div')
  el.className = 'scroller'
  el.tabIndex = 0
  const exp = d.experience.map((e) => `<article class="item"><div class="top"><h3>${esc(e.company_zh)}</h3><span class="period">${esc(e.period)}</span></div>
    <div class="role">${esc(e.role_zh)}</div><ul>${(e.highlights_zh ?? []).slice(0, 4).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></article>`).join('')
  const proj = d.projects.map((p) => `<article class="item"><h3>${esc(p.title_zh)}</h3><div class="role">${esc(p.summary_zh)}</div>
    <div class="tags">${(p.tags ?? []).map((t) => `<span>${esc(t)}</span>`).join('')}${(p.links ?? []).slice(0, 1).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div></article>`).join('')
  el.innerHTML = `<div class="spacer"></div><div class="section">${esc(d.profile.name_zh)} · ${esc(d.profile.tagline_zh)}</div><div class="section">经历 Experience</div>${exp}<div class="section">项目 Projects</div>${proj}<div class="spacer"></div>`
  return el
}
