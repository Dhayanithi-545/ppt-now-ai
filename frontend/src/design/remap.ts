import { LAYOUT_SPEC, type Item, type LayoutId, type SlideContent } from './types'

type FieldSpec = { min?: number; max?: number; fields?: Record<string, unknown> }

/** Data a layout cannot work without (switching to it from other content needs the AI). */
export function missingData(layout: LayoutId, c: SlideContent): string | null {
  const f = LAYOUT_SPEC[layout].fields as Record<string, FieldSpec>
  if ('chart' in f && !c.chart?.series?.length) return 'chart'
  if ('table' in f && !c.table?.headers?.length) return 'table'
  if ('quote' in f && !c.quote) return 'quote'
  const need = f.items?.min ?? 0
  if (need && remapItems(c).length < need) return 'items'
  return null
}

function remapItems(c: SlideContent): Item[] {
  if (c.items?.length) return c.items
  if (c.bullets?.length) {
    return c.bullets.map((b) => {
      const m = /^(.{3,40}?)[:—–-]\s+(.+)$/.exec(b)
      return m ? { title: m[1], text: m[2] } : { title: b.length <= 40 ? b : undefined, text: b.length > 40 ? b : undefined }
    })
  }
  return []
}

/** Re-shape content for a different layout locally (lossless where possible). */
export function remapContent(c: SlideContent, to: LayoutId): SlideContent {
  const f = LAYOUT_SPEC[to].fields as Record<string, FieldSpec>
  const out: SlideContent = { ...c }
  if ('items' in f && !c.items?.length) {
    out.items = remapItems(c)
  }
  if ('bullets' in f && !c.bullets?.length && c.items?.length) {
    out.bullets = c.items.map((i) => [i.title ?? i.value, i.text].filter(Boolean).join(': ')).filter(Boolean)
  }
  if ('items' in f && f.items?.max && out.items) {
    out.items = out.items.slice(0, f.items.max).map((it) => ({ ...it, icon: it.icon ?? 'sparkles' }))
  }
  if ('quote' in f && !c.quote && c.title) {
    out.quote = c.title
  }
  if ('title' in f && !out.title && c.quote) out.title = c.quote
  return out
}
