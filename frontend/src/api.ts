import { API_BASE } from './config'
import type { Brief, Deck, LayoutId, OutlineItem, Slide, Theme } from './design/types'

export interface Capabilities {
  stockPhotos: boolean
  stockProvider: string | null
  imageGeneration: boolean
  imageModel: string | null
  grounding: boolean
  model: string
}

export interface ClarifyQuestion {
  question: string
  options: string[]
}

export interface ImageResult {
  url: string
  thumb: string
  credit: string
  alt: string
  source: string
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(API_BASE + url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = r.statusText
    try {
      const j = await r.json()
      // FastAPI validation errors arrive as a list of {loc, msg}; show the messages, not raw JSON.
      msg =
        typeof j.detail === 'string'
          ? j.detail
          : Array.isArray(j.detail)
            ? j.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ')
            : JSON.stringify(j.detail ?? j)
    } catch {
      /* not json */
    }
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  capabilities: () => req<Capabilities>('GET', '/api/capabilities'),
  listDecks: () => req<{ id: string; title: string; updated: number; themeId: string; theme?: Theme; slideCount: number; cover?: Slide }[]>('GET', '/api/decks'),
  getDeck: (id: string) => req<Deck>('GET', `/api/decks/${id}`),
  saveDeck: (deck: Deck, note?: string) => req<Deck>('PATCH', `/api/decks/${deck.id}`, { ...deck, _note: note }),
  deleteDeck: (id: string) => req<{ ok: boolean }>('DELETE', `/api/decks/${id}`),
  clarify: (brief: Brief) => req<{ needs_clarification: boolean; questions: ClarifyQuestion[] }>('POST', '/api/decks/clarify', brief),
  outline: (brief: Brief, answers: { question: string; answer: string }[], themeId: string, theme?: Theme) =>
    req<Deck>('POST', '/api/decks/outline', { brief, answers, theme_id: themeId, theme }),
  versions: (id: string) => req<{ id: number; note: string | null; created: number }[]>('GET', `/api/decks/${id}/versions`),
  version: (id: string, vid: number) => req<Deck>('GET', `/api/decks/${id}/versions/${vid}`),
  chatEdit: (deck: Deck, message: string, currentSlide: number) =>
    req<{ deck: Deck; reply: string; changed: string[] }>('POST', `/api/decks/${deck.id}/chat-edit`, { message, current_slide: currentSlide, deck }),
  regenerate: (deck: Deck, n: number, instruction?: string, layout?: LayoutId) =>
    req<{ index: number; slide: Slide }>('POST', `/api/decks/${deck.id}/slides/${n}/regenerate`, { instruction, layout, deck }),
  fit: (deckId: string, n: number, slide: Slide, attempt: number) =>
    req<{ index: number; slide: Slide }>('POST', `/api/decks/${deckId}/slides/${n}/fit`, { slide, attempt }),
  themeFromPrompt: (prompt: string) => req<{ theme: Theme; fixes: string[] }>('POST', '/api/themes/from-prompt', { prompt, save: true }),
  listThemes: () => req<Theme[]>('GET', '/api/themes'),
  deleteTheme: (id: string) => req<{ ok: boolean }>('DELETE', `/api/themes/${id}`),
  searchImages: (q: string) => req<{ results: ImageResult[]; stock: boolean; generation: boolean }>('GET', `/api/images/search?q=${encodeURIComponent(q)}`),
  selectImage: (url: string) => req<{ url: string }>('POST', '/api/images/select', { url }),
  generateImage: (prompt: string) => req<{ url: string; credit: string }>('POST', '/api/images/generate', { prompt }),
  uploadImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return req<{ url: string }>('POST', '/api/images/upload', fd)
  },
  async exportPdf(deck: Deck, filename: string): Promise<Blob> {
    const r = await fetch(`${API_BASE}/api/decks/${deck.id}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, deck }),
    })
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? 'PDF export failed')
    return r.blob()
  },
}

export type GenEvent =
  | { event: 'start'; data: { deck: Deck } }
  | { event: 'slide'; data: { index: number; slide: Slide } }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: { deck: Deck } }

/** POST + server-sent events (EventSource only supports GET, so parse the stream manually). */
export async function streamGenerate(deckId: string, body: { title?: string; outline?: OutlineItem[] }, onEvent: (e: GenEvent) => void, signal?: AbortSignal) {
  const r = await fetch(`${API_BASE}/api/decks/${deckId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok || !r.body) throw new Error(`Generation failed (${r.status})`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const data = /^data: (.*)$/m.exec(block)?.[1]
      if (ev && data) onEvent({ event: ev, data: JSON.parse(data) } as GenEvent)
    }
  }
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
