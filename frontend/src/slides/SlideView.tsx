import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { assetUrl } from '../config'
import { heroVars, themeVars } from '../design/themeVars'
import { FONTS, variantOf, variantsOf, type Slide, type Theme } from '../design/types'
import { SlideCtx, type SlideCtxValue } from './context'
import { Decor } from './Decor'
import { INVERSE_LAYOUTS, LAYOUTS, isHero } from './registry'
import { cx } from './primitives'
import './slide.css'

export const SLIDE_W = 1280
export const SLIDE_H = 720
const MIN_FIT = 0.78

export interface SlideViewProps {
  slide: Slide
  theme: Theme
  index?: number
  total?: number
  deckTitle?: string
  editable?: boolean
  print?: boolean
  onEdit?: (path: string, value: string) => void
  onImageClick?: (path: string) => void
  /** Reports the result of the auto-fit pass (1 = no shrink; overflow = still overflowing). */
  onFit?: (fit: number, overflow: boolean) => void
}

function bulletMarker(t: Theme): string {
  if (t.fonts.headingUppercase || t.cardStyle === 'brutal') return 'square'
  if (t.eyebrowStyle === 'mono') return 'chevron'
  if (t.radius === 0) return 'dash'
  if (t.motif === 'frame') return 'diamond'
  return 'dot'
}

/** True if any card's content spills out of it, or any text runs off the safe area of the slide. */
function measureOverflow(root: HTMLElement): boolean {
  const box = root.getBoundingClientRect()
  const k = box.width / SLIDE_W
  // In-flow children must stay inside their card (decorative absolute children are allowed to bleed).
  for (const card of root.querySelectorAll<HTMLElement>('.card')) {
    const cb = card.getBoundingClientRect().bottom + 2 * k
    for (const child of card.children) {
      if (getComputedStyle(child).position === 'absolute') continue
      if (child.getBoundingClientRect().bottom > cb) return true
    }
  }
  const bottom = box.bottom - (root.classList.contains('sl-hero') ? 24 : 52) * k
  const right = box.right - 24 * k
  for (const el of root.querySelectorAll<HTMLElement>('.sl-main [data-field]')) {
    const r = el.getBoundingClientRect()
    if (r.height && (r.bottom > bottom || r.right > right)) return true
  }
  return false
}

/** One slide at native 1280×720. Scale it with <SlideCanvas>. */
export function SlideView({ slide, theme, index = 0, total = 1, deckTitle = '', editable = false, print = false, onEdit, onImageClick, onFit }: SlideViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const Layout = LAYOUTS[slide.layout] ?? LAYOUTS['title-bullets']
  const hero = isHero(slide.layout)
  const variant = variantOf(slide.layout, slide.variant)
  const pos = variantsOf(slide.layout).find((v) => v.id === variant)?.pos
  const hv = INVERSE_LAYOUTS.has(slide.layout) ? heroVars(theme) : null
  const inverse = !!hv
  const style = useMemo(() => ({ ...themeVars(theme), ...(hv ?? {}) }) as CSSProperties, [theme, hv])
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let alive = true
    document.fonts.ready.then(() => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])

  const contentKey = JSON.stringify(slide.content)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let fit = 1
    root.style.setProperty('--fit', '1')
    while (measureOverflow(root) && fit > MIN_FIT) {
      fit = Math.round((fit - 0.04) * 100) / 100
      root.style.setProperty('--fit', String(fit))
    }
    const overflow = measureOverflow(root)
    root.dataset.fit = String(fit)
    root.dataset.overflow = String(overflow)
    onFit?.(fit, overflow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, slide.layout, variant, theme, fontsReady])

  const ctx: SlideCtxValue = {
    slide, content: slide.content, variant, theme, index, total, deckTitle, inverse, editable, print, onEdit, onImageClick,
  }

  return (
    <SlideCtx.Provider value={ctx}>
      <div
        ref={ref}
        className={cx('sl', `sl-${theme.mode}`, hero ? 'sl-hero' : 'sl-content', inverse && 'sl-inverse', editable && 'sl-editable', `card-${theme.cardStyle}`, `shadow-${theme.shadow}`, theme.gradientText && !inverse && 'grad-text-on')}
        data-layout={slide.layout}
        data-variant={variant}
        data-pos={pos}
        data-theme={theme.id}
        data-motif={theme.motif}
        data-marker={bulletMarker(theme)}
        data-hkind={FONTS[theme.fonts.heading].kind}
        data-slide-id={slide.id}
        style={style}
      >
        <Decor theme={theme} hero={hero} inverse={inverse} seed={index} photo={theme.background === 'photo' ? assetUrl(slide.content.image?.url) : undefined} />
        <div className="sl-main">
          <Layout />
        </div>
        {!hero && (
          <footer className="sl-foot">
            <span data-pptx="text">{deckTitle}</span>
            <span data-pptx="text" className="sl-page">{String(index + 1).padStart(2, '0')}</span>
          </footer>
        )}
      </div>
    </SlideCtx.Provider>
  )
}
