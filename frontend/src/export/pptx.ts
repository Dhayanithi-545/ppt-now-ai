/**
 * Hybrid PPTX export (PptxGenJS, in the browser).
 *
 * For every slide rendered at native 1280×720:
 *  1. Editable objects (text, icons, images, charts, tables) are hidden and the remaining decorative layer
 *     (background, gradients, blobs, cards, shapes) is rasterized at 2× with html-to-image -> slide background.
 *  2. The objects are added on top as separate PowerPoint objects at the positions measured from the DOM:
 *     text boxes (editable), PNG icons/pictures, native charts and native tables. Speaker notes are added.
 */
import { toJpeg, toPng } from 'html-to-image'
import PptxGenJS from 'pptxgenjs'
import { FONTS, type ChartSpec, type Deck, type FontName, type Theme } from '../design/types'
import { seriesColors } from '../design/themeVars'

const PX_PER_IN = 96 // 1280 px = 13.333 in (LAYOUT_WIDE)

export interface PptxOptions {
  /** Replace theme fonts with universally installed fonts (Arial / Georgia). */
  safeFonts?: boolean
  onProgress?: (done: number, total: number) => void
}

type Kind = 'text' | 'image' | 'icon' | 'chart' | 'table'
interface Obj {
  el: HTMLElement
  kind: Kind
}

// ------------------------------------------------------------------ helpers (exported for tests)

export function pxToIn(px: number): number {
  return Math.round((px / PX_PER_IN) * 1000) / 1000
}

export function pxToPt(px: number): number {
  return Math.round(px * 0.75 * 10) / 10
}

/** CSS color -> { hex (no #), alpha 0..1 } or null for fully transparent. */
export function parseColor(css: string): { hex: string; alpha: number } | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(css)
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    if (a <= 0.01) return null
    a = Math.min(1, a)
    const hex = [m[1], m[2], m[3]].map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('').toUpperCase()
    return { hex, alpha: a }
  }
  const h = /^#([0-9a-f]{6})/i.exec(css.trim())
  if (h) return { hex: h[1].toUpperCase(), alpha: 1 }
  return null
}

/** First family of a computed font-family list, without quotes or the fontsource " Variable" suffix. */
export function primaryFont(family: string): string {
  const first = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  return first.replace(/ Variable$/, '')
}

export function fontFor(family: string, safe: boolean): string {
  const name = primaryFont(family)
  if (!safe) return name
  const meta = FONTS[name as FontName]
  return meta?.fallback ?? 'Arial'
}

export function chartType(pptx: PptxGenJS, t: ChartSpec['type']) {
  switch (t) {
    case 'line':
      return pptx.ChartType.line
    case 'area':
      return pptx.ChartType.area
    case 'pie':
      return pptx.ChartType.pie
    case 'donut':
      return pptx.ChartType.doughnut
    default:
      return pptx.ChartType.bar
  }
}

/** Blend an rgba colour over a solid background (PowerPoint table fills have no alpha). */
function blend(c: { hex: string; alpha: number }, over: string): string {
  if (c.alpha >= 0.99) return c.hex
  const a = parseInt(c.hex, 16)
  const b = parseInt(over, 16)
  const ch = (n: number, s: number) => (n >> s) & 255
  const mixc = (s: number) => Math.round(ch(a, s) * c.alpha + ch(b, s) * (1 - c.alpha))
  return [16, 8, 0].map((s) => mixc(s).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ------------------------------------------------------------------ collection

function collect(root: HTMLElement): Obj[] {
  const out: Obj[] = []
  const taken: HTMLElement[] = []
  const inside = (el: HTMLElement) => taken.some((t) => t !== el && t.contains(el))
  const visible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return r.width > 0.5 && r.height > 0.5 && getComputedStyle(el).visibility !== 'hidden'
  }
  // Containers first so their inner text/images are skipped.
  for (const el of root.querySelectorAll<HTMLElement>('[data-pptx="table"], [data-pptx="chart"], [data-pptx-group="image"]')) {
    if (el.closest('.fb-img')) continue // full-bleed photo stays in the background so the overlay stays on top
    if (!visible(el)) continue
    const kind: Kind = el.dataset.pptx === 'table' ? 'table' : el.dataset.pptx === 'chart' ? 'chart' : 'image'
    out.push({ el, kind })
    taken.push(el)
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-pptx="icon"], [data-pptx="image"], [data-pptx="text"]')) {
    if (inside(el) || el.closest('.fb-img') || !visible(el)) continue
    const kind = el.dataset.pptx as Kind
    if (kind === 'text' && !el.innerText.trim()) continue
    out.push({ el, kind })
    taken.push(el)
  }
  return out
}

function rectIn(el: HTMLElement, root: DOMRect, k: number) {
  const r = el.getBoundingClientRect()
  return { x: (r.left - root.left) / k, y: (r.top - root.top) / k, w: r.width / k, h: r.height / k }
}

// ------------------------------------------------------------------ objects

function addText(slide: PptxGenJS.Slide, o: Obj, root: DOMRect, k: number, theme: Theme, safe: boolean) {
  const el = o.el
  const cs = getComputedStyle(el)
  const r = rectIn(el, root, k)
  const fontPx = parseFloat(cs.fontSize)
  const lh = cs.lineHeight === 'normal' ? fontPx * 1.2 : parseFloat(cs.lineHeight)
  let color = parseColor(cs.color)
  // Gradient-clipped text has a transparent colour: use the gradient's start colour.
  if (!color) color = { hex: theme.gradient.from.replace('#', '').toUpperCase(), alpha: 1 }
  const strokeColor = parseColor(cs.getPropertyValue('-webkit-text-stroke-color'))
  const stroke = parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) || 0
  const align = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left'
  const singleLine = r.h < lh * 1.5
  // PowerPoint's text metrics differ slightly from Chrome's: give boxes a little slack so lines don't re-wrap.
  const slack = Math.max(6, r.w * 0.04)
  const x = align === 'center' ? r.x - slack / 2 : align === 'right' ? r.x - slack : r.x
  const base: PptxGenJS.TextPropsOptions = {
    x: pxToIn(x),
    y: pxToIn(r.y),
    w: pxToIn(r.w + slack),
    h: pxToIn(Math.max(r.h, lh)),
    fontFace: fontFor(cs.fontFamily, safe),
    fontSize: pxToPt(fontPx),
    bold: parseInt(cs.fontWeight, 10) >= 600,
    italic: cs.fontStyle === 'italic',
    color: (stroke && !parseColor(cs.color) && strokeColor ? strokeColor : color).hex,
    transparency: Math.round((1 - color.alpha) * 100),
    align,
    valign: 'top',
    margin: 0,
    wrap: !singleLine,
    lineSpacing: pxToPt(lh),
    charSpacing: cs.letterSpacing === 'normal' ? undefined : pxToPt(parseFloat(cs.letterSpacing)) || undefined,
    fit: 'none',
  }
  if (stroke && !parseColor(cs.color) && strokeColor) {
    base.outline = { size: pxToPt(stroke), color: strokeColor.hex }
  }
  // Keep the browser's exact line breaks (as soft breaks inside one paragraph) so the layout survives
  // font substitution in PowerPoint, and keep highlighted phrases in their own colour.
  const hlEl = el.querySelector<HTMLElement>('.hl')
  const hcs = hlEl ? getComputedStyle(hlEl) : null
  const hcolor = hcs ? parseColor(hcs.color) ?? { hex: theme.colors.primary.replace('#', '').toUpperCase(), alpha: 1 } : null
  const upper = cs.textTransform === 'uppercase'
  const runs: PptxGenJS.TextProps[] = []
  textLines(el).forEach((line, li) =>
    line.forEach((seg, si) => {
      const options: PptxGenJS.TextPropsOptions = {}
      if (li > 0 && si === 0) options.softBreakBefore = true
      if (seg.hl && hcolor) {
        options.color = hcolor.hex
        options.italic = hcs?.fontStyle === 'italic'
      }
      runs.push({ text: upper ? seg.text.toUpperCase() : seg.text, options })
    }),
  )
  slide.addText(runs.length ? runs : el.innerText, base)
}

/** Words grouped into the visual lines Chrome laid out (via Range rects), split where highlight starts/ends. */
export function textLines(el: HTMLElement): { text: string; hl: boolean }[][] {
  const lines: { top: number; segs: { text: string; hl: boolean }[] }[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const t = node.textContent ?? ''
    const hl = !!node.parentElement?.closest('.hl')
    const re = /\S+\s*/g
    // Whitespace that starts a text node belongs between the previous node's last word and this one.
    let lead = /^\s/.test(t) ? ' ' : ''
    for (let m = re.exec(t); m; m = re.exec(t)) {
      const word = m[0].trimEnd()
      range.setStart(node, m.index)
      range.setEnd(node, m.index + word.length)
      const r = range.getClientRects()[0]
      if (!r) continue
      let line = lines[lines.length - 1]
      if (!line || r.top > line.top + r.height * 0.5) {
        line = { top: r.top, segs: [] }
        lines.push(line)
      }
      const last = line.segs[line.segs.length - 1]
      if (lead && last && !/\s$/.test(last.text)) last.text += lead
      lead = ''
      if (last && last.hl === hl) last.text += m[0]
      else line.segs.push({ text: m[0], hl })
    }
  }
  return lines.map((l) => {
    const segs = l.segs.map((x) => ({ ...x }))
    if (segs.length) segs[segs.length - 1].text = segs[segs.length - 1].text.trimEnd()
    return segs.filter((x) => x.text)
  })
}

async function addPicture(slide: PptxGenJS.Slide, o: Obj, root: DOMRect, k: number, ratio: number) {
  const r = rectIn(o.el, root, k)
  // Neutralise layout offsets: html-to-image copies them and would draw the element outside its own canvas.
  const data = await toPng(o.el, {
    pixelRatio: ratio, cacheBust: false, skipFonts: true, width: r.w, height: r.h,
    style: { position: 'static', inset: 'auto', margin: '0', transform: 'none', width: `${r.w}px`, height: `${r.h}px` },
  })
  slide.addImage({ data, x: pxToIn(r.x), y: pxToIn(r.y), w: pxToIn(r.w), h: pxToIn(r.h) })
}

function addChart(pptx: PptxGenJS, slide: PptxGenJS.Slide, o: Obj, root: DOMRect, k: number, theme: Theme, safe: boolean) {
  const spec = JSON.parse(o.el.dataset.chart || 'null') as ChartSpec | null
  if (!spec?.series?.length) return
  const r = rectIn(o.el, root, k)
  const cols = seriesColors(theme).map((c) => c.replace('#', ''))
  const pie = spec.type === 'pie' || spec.type === 'donut'
  const multi = spec.series.length > 1
  const font = safe ? 'Arial' : theme.fonts.body
  const muted = theme.colors.muted.replace('#', '')
  const text = theme.colors.text.replace('#', '')
  const grid = parseColor(getComputedStyle(o.el.closest('.sl') as HTMLElement).getPropertyValue('--border'))?.hex ?? 'DDDDDD'
  const data = (pie ? spec.series.slice(0, 1) : spec.series).map((s) => ({ name: s.name, labels: spec.categories, values: s.values }))
  const opts: PptxGenJS.IChartOpts = {
    x: pxToIn(r.x), y: pxToIn(r.y), w: pxToIn(r.w), h: pxToIn(r.h),
    chartColors: pie ? spec.categories.map((_, i) => cols[i % cols.length]) : cols,
    showLegend: multi || pie,
    legendPos: pie ? 'r' : 't',
    legendFontFace: font, legendFontSize: 11, legendColor: text,
    catAxisLabelColor: muted, valAxisLabelColor: muted, catAxisLabelFontFace: font, valAxisLabelFontFace: font,
    catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
    valGridLine: { color: grid, style: 'dash', size: 0.75 },
    catGridLine: { style: 'none' },
    catAxisLineShow: true, valAxisLineShow: false,
    dataLabelColor: pie ? 'FFFFFF' : text, dataLabelFontFace: font, dataLabelFontSize: 11, dataLabelFontBold: true,
    showValue: !pie && !multi && spec.categories.length <= 8,
    showPercent: pie,
    barDir: spec.type === 'hbar' ? 'bar' : 'col',
    barGapWidthPct: 60,
    holeSize: spec.type === 'donut' ? 58 : undefined,
    lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 7, lineSmooth: true,
    valAxisLabelFormatCode: spec.unit === '%' ? '0"%"' : undefined,
  }
  slide.addChart(chartType(pptx, spec.type), data, opts)
}

function addTable(slide: PptxGenJS.Slide, o: Obj, root: DOMRect, k: number, theme: Theme, safe: boolean) {
  const table = o.el.querySelector('table')
  if (!table) return
  const r = rectIn(o.el, root, k)
  const bg = (parseColor(getComputedStyle(o.el).backgroundColor) ?? { hex: theme.colors.bg.replace('#', ''), alpha: 1 }).hex
  const rows: PptxGenJS.TableRow[] = []
  const heights: number[] = []
  for (const tr of table.querySelectorAll('tr')) {
    heights.push(pxToIn(tr.getBoundingClientRect().height / k))
    const cells: PptxGenJS.TableCell[] = []
    for (const td of tr.children) {
      const cs = getComputedStyle(td)
      const fill = parseColor(cs.backgroundColor)
      const color = parseColor(cs.color) ?? { hex: '000000', alpha: 1 }
      const border = parseColor(cs.borderTopColor)
      cells.push({
        text: (td as HTMLElement).innerText,
        options: {
          fill: fill ? { color: blend(fill, bg) } : { color: bg },
          color: color.hex,
          bold: parseInt(cs.fontWeight, 10) >= 600,
          fontFace: fontFor(cs.fontFamily, safe),
          fontSize: pxToPt(parseFloat(cs.fontSize)),
          valign: 'middle',
          margin: [pxToPt(parseFloat(cs.paddingTop)), pxToPt(parseFloat(cs.paddingRight)), pxToPt(parseFloat(cs.paddingBottom)), pxToPt(parseFloat(cs.paddingLeft))],
          border: [
            { type: border && parseFloat(cs.borderTopWidth) ? 'solid' : 'none', pt: 0.75, color: border ? blend(border, bg) : 'FFFFFF' },
            { type: 'none' }, { type: 'none' }, { type: 'none' },
          ],
        },
      })
    }
    rows.push(cells)
  }
  const colW = [...(table.querySelector('tr')?.children ?? [])].map((c) => pxToIn(c.getBoundingClientRect().width / k))
  slide.addTable(rows, { x: pxToIn(r.x), y: pxToIn(r.y), w: pxToIn(r.w), colW, rowH: heights })
}

// ------------------------------------------------------------------ main

export async function buildPptx(deck: Deck, theme: Theme, slideEls: HTMLElement[], opts: PptxOptions = {}): Promise<Blob> {
  const safe = !!opts.safeFonts
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = deck.title
  pptx.company = 'Aira'
  pptx.theme = {
    headFontFace: safe ? FONTS[theme.fonts.heading].fallback : theme.fonts.heading,
    bodyFontFace: safe ? FONTS[theme.fonts.body].fallback : theme.fonts.body,
  }
  await document.fonts.ready

  for (let i = 0; i < slideEls.length; i++) {
    const root = slideEls[i]
    const box = root.getBoundingClientRect()
    const k = box.width / 1280
    const objs = collect(root)

    // 1) decorative layer -> background image
    const prev = objs.map((o) => o.el.style.visibility)
    objs.forEach((o) => (o.el.style.visibility = 'hidden'))
    let bg: string
    try {
      // JPEG keeps a 20-slide deck at a few MB; the decorative layer has no hard text edges left to blur.
      bg = await toJpeg(root, { pixelRatio: 2, quality: 0.9, cacheBust: false, skipFonts: true, width: 1280, height: 720, backgroundColor: theme.colors.bg })
    } finally {
      objs.forEach((o, j) => (o.el.style.visibility = prev[j]))
    }

    const slide = pptx.addSlide()
    slide.background = { data: bg }

    // 2) editable objects on top, in DOM order
    for (const o of objs) {
      try {
        if (o.kind === 'text') addText(slide, o, box, k, theme, safe)
        else if (o.kind === 'chart') addChart(pptx, slide, o, box, k, theme, safe)
        else if (o.kind === 'table') addTable(slide, o, box, k, theme, safe)
        else await addPicture(slide, o, box, k, o.kind === 'icon' ? 4 : 2)
      } catch (e) {
        console.warn('pptx object skipped', o.kind, e)
      }
    }
    const notes = deck.slides[i]?.notes
    if (notes) slide.addNotes(notes)
    opts.onProgress?.(i + 1, slideEls.length)
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob
}
