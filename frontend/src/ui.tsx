import { Loader2, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { api } from './api'
import { THEMES, THEME_BY_ID } from './design/themes'
import type { Deck, Theme } from './design/types'

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

interface Toast {
  id: number
  text: string
  err?: boolean
}
const useToasts = create<{ list: Toast[]; push: (t: string, err?: boolean) => void }>((set, get) => ({
  list: [],
  push: (text, err) => {
    const id = Date.now() + Math.random()
    set({ list: [...get().list, { id, text, err }] })
    setTimeout(() => set({ list: get().list.filter((t) => t.id !== id) }), err ? 6000 : 3200)
  },
}))
export const toast = (text: string) => useToasts.getState().push(text)
export const toastError = (e: unknown) => useToasts.getState().push(e instanceof Error ? e.message : String(e), true)

export function Toasts() {
  const list = useToasts((s) => s.list)
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className={'toast' + (t.err ? ' err' : '')}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** Built-in themes + saved custom themes. */
export const useCustomThemes = create<{ list: Theme[]; loaded: boolean; load: () => Promise<void>; add: (t: Theme) => void; remove: (id: string) => void }>((set, get) => ({
  list: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      set({ list: await api.listThemes(), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  add: (t) => set({ list: [t, ...get().list.filter((x) => x.id !== t.id)] }),
  remove: (id) => set({ list: get().list.filter((x) => x.id !== id) }),
}))

export function allThemes(custom: Theme[]): Theme[] {
  return [...custom, ...THEMES]
}

export function deckTheme(deck: Pick<Deck, 'themeId' | 'theme'>): Theme {
  return deck.theme ?? THEME_BY_ID[deck.themeId] ?? THEMES[0]
}

export function useAppTheme(): [string, () => void] {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('aira-app-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.appTheme = mode
    try {
      localStorage.setItem('aira-app-theme', mode)
    } catch {
      /* storage blocked */
    }
  }, [mode])
  return [mode, () => setMode(mode === 'dark' ? 'light' : 'dark')]
}

export function AppThemeButton() {
  const [mode, toggle] = useAppTheme()
  return (
    <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle dark / light" aria-label="Toggle dark or light mode">
      {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="Aira home">
      <img className="brand-logo" src="/logo.png" alt="" width={34} height={34} />
      {!compact && <span className="brand-name">Aira</span>}
    </a>
  )
}

/** Small dropdown menu (used for overflow actions on narrow screens). */
export function Menu({ label, icon, children, align = 'right' }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="rel" ref={ref}>
      <button className="btn btn-ghost btn-icon" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
      </button>
      {open && (
        <div className="pop menu" role="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/** True once the page has scrolled (adds a hairline under sticky bars). */
export function useScrolled(): boolean {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return s
}
