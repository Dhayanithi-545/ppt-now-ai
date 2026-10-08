import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Deck, Theme } from '../../design/types'
import { SlideCanvas } from '../../slides/SlideCanvas'

/** Full-screen presenter: arrows / space / PageUp-Down / Home / End, Esc to exit. */
export function Presenter({ deck, theme, start, onClose }: { deck: Deck; theme: Theme; start: number; onClose: (at: number) => void }) {
  const [i, setI] = useState(start)
  const [cursor, setCursor] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)
  const n = deck.slides.length

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) setI((x) => Math.min(n - 1, x + 1))
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) setI((x) => Math.max(0, x - 1))
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
      else if (e.key === 'Escape') close()
      else return
      e.preventDefault()
    }
    const onFs = () => !document.fullscreenElement && close()
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const iRef = useRef(i)
  iRef.current = i
  function close() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    onClose(iRef.current)
  }

  function wake() {
    setCursor(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCursor(false), 2000)
  }

  const s = deck.slides[i]
  return (
    <div ref={root} className={'present' + (cursor ? ' show-cursor' : '')} onMouseMove={wake} onClick={(e) => e.clientX > window.innerWidth / 3 ? setI(Math.min(n - 1, i + 1)) : setI(Math.max(0, i - 1))}>
      <div className="present-frame">
        <SlideCanvas key={s.id} slide={s} theme={theme} index={i} total={n} deckTitle={deck.title} />
      </div>
      <div className="present-hud" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous"><ChevronLeft size={18} /></button>
        <span>{i + 1} / {n}</span>
        <button onClick={() => setI(Math.min(n - 1, i + 1))} aria-label="Next"><ChevronRight size={18} /></button>
        <button onClick={close} aria-label="Exit"><X size={16} /></button>
      </div>
    </div>
  )
}
