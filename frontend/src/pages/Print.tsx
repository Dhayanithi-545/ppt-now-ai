import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import type { Deck } from '../design/types'
import { SlideView } from '../slides/SlideView'
import { deckTheme } from '../ui'

declare global {
  interface Window {
    __PRINT_READY?: boolean
  }
}

/** Every slide at native 1280×720, one per page. Playwright prints this route to PDF. */
export default function Print() {
  const { id = '' } = useParams()
  const [deck, setDeck] = useState<Deck | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.appTheme = 'light'
    api.getDeck(id).then(setDeck)
  }, [id])

  useEffect(() => {
    if (!deck) return
    ;(async () => {
      await document.fonts.ready
      const imgs = [...(ref.current?.querySelectorAll('img') ?? [])]
      await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))))
      await new Promise((r) => setTimeout(r, 300)) // charts + auto-fit settle
      window.__PRINT_READY = true
    })()
  }, [deck])

  if (!deck) return null
  const theme = deckTheme(deck)
  return (
    <div className="print-root" ref={ref}>
      {deck.slides.map((s, i) => (
        <div className="print-page" key={s.id}>
          <SlideView slide={s} theme={theme} index={i} total={deck.slides.length} deckTitle={deck.title} print />
        </div>
      ))}
    </div>
  )
}
