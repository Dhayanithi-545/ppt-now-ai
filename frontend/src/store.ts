import { create } from 'zustand'
import { remapContent } from './design/remap'
import type { Deck, LayoutId, Slide, Theme } from './design/types'
import { setPath } from './slides/context'

const MAX_HISTORY = 100

export const uid = () => Math.random().toString(36).slice(2, 14)

interface EditorState {
  deck: Deck | null
  past: Deck[]
  future: Deck[]
  current: number
  generating: boolean
  /** slide id -> what is happening ("Regenerating…", "Fitting text…") */
  busy: Record<string, string>
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  /** Bumped on every user-visible change; the autosaver watches it. */
  rev: number

  load: (deck: Deck) => void
  /** Apply a change. history=false for streamed generation updates. */
  commit: (next: Deck, history?: boolean) => void
  undo: () => void
  redo: () => void
  select: (i: number) => void
  setBusy: (slideId: string, label: string | null) => void
  setGenerating: (v: boolean) => void
  setSaveState: (s: EditorState['saveState']) => void

  editField: (index: number, path: string, value: string) => void
  setSlide: (index: number, slide: Slide, history?: boolean) => void
  changeLayout: (index: number, layout: LayoutId) => void
  duplicate: (index: number) => void
  remove: (index: number) => void
  move: (from: number, to: number) => void
  setTheme: (themeId: string, custom?: Theme) => void
  setNotes: (index: number, notes: string) => void
  rename: (title: string) => void
}

export const useEditor = create<EditorState>((set, get) => ({
  deck: null,
  past: [],
  future: [],
  current: 0,
  generating: false,
  busy: {},
  saveState: 'idle',
  rev: 0,

  load: (deck) => set({ deck, past: [], future: [], current: 0, busy: {}, saveState: 'saved', rev: 0 }),

  commit: (next, history = true) => {
    const { deck, past, rev } = get()
    if (!deck) return set({ deck: next })
    set({
      deck: next,
      past: history ? [...past, deck].slice(-MAX_HISTORY) : past,
      future: history ? [] : get().future,
      rev: rev + 1,
    })
  },

  undo: () => {
    const { past, deck, future, rev, current } = get()
    if (!past.length || !deck) return
    const prev = past[past.length - 1]
    set({ deck: prev, past: past.slice(0, -1), future: [deck, ...future], rev: rev + 1, current: Math.min(current, prev.slides.length - 1) })
  },

  redo: () => {
    const { past, deck, future, rev, current } = get()
    if (!future.length || !deck) return
    const next = future[0]
    set({ deck: next, past: [...past, deck], future: future.slice(1), rev: rev + 1, current: Math.min(current, next.slides.length - 1) })
  },

  select: (i) => {
    const n = get().deck?.slides.length ?? 0
    set({ current: Math.max(0, Math.min(n - 1, i)) })
  },
  setBusy: (id, label) => {
    const busy = { ...get().busy }
    if (label) busy[id] = label
    else delete busy[id]
    set({ busy })
  },
  setGenerating: (generating) => set({ generating }),
  setSaveState: (saveState) => set({ saveState }),

  editField: (index, path, value) => {
    const deck = get().deck
    if (!deck) return
    const slides = [...deck.slides]
    slides[index] = { ...slides[index], content: setPath(slides[index].content, path, value) }
    get().commit({ ...deck, slides })
  },

  setSlide: (index, slide, history = true) => {
    const deck = get().deck
    if (!deck) return
    const slides = [...deck.slides]
    slides[index] = slide
    get().commit({ ...deck, slides }, history)
  },

  changeLayout: (index, layout) => {
    const deck = get().deck
    if (!deck) return
    const s = deck.slides[index]
    get().setSlide(index, { ...s, layout, content: remapContent(s.content, layout) })
  },

  duplicate: (index) => {
    const deck = get().deck
    if (!deck) return
    const slides = [...deck.slides]
    slides.splice(index + 1, 0, { ...structuredClone(slides[index]), id: uid() })
    get().commit({ ...deck, slides })
    set({ current: index + 1 })
  },

  remove: (index) => {
    const deck = get().deck
    if (!deck || deck.slides.length <= 1) return
    const slides = deck.slides.filter((_, i) => i !== index)
    get().commit({ ...deck, slides })
    set({ current: Math.min(index, slides.length - 1) })
  },

  move: (from, to) => {
    const deck = get().deck
    if (!deck || from === to) return
    const slides = [...deck.slides]
    const [s] = slides.splice(from, 1)
    slides.splice(to, 0, s)
    get().commit({ ...deck, slides })
    set({ current: to })
  },

  setTheme: (themeId, custom) => {
    const deck = get().deck
    if (!deck) return
    const next: Deck = { ...deck, themeId, theme: custom }
    if (!custom) delete next.theme
    get().commit(next)
  },

  setNotes: (index, notes) => {
    const deck = get().deck
    if (!deck) return
    get().setSlide(index, { ...deck.slides[index], notes })
  },

  rename: (title) => {
    const deck = get().deck
    if (deck && title.trim() && title !== deck.title) get().commit({ ...deck, title: title.trim() })
  },
}))
