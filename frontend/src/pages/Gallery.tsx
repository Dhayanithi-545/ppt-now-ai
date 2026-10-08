import { useMemo, useState } from 'react'
import { download } from '../api'
import { buildPptx } from '../export/pptx'
import { useSearchParams } from 'react-router-dom'
import { THEMES, getTheme } from '../design/themes'
import { LAYOUT_IDS, LAYOUT_SPEC, type LayoutId, type Slide } from '../design/types'
import { SAMPLES } from '../slides/samples'
import { SlideCanvas } from '../slides/SlideCanvas'
import { SlideView } from '../slides/SlideView'
import './gallery.css'

function sampleSlide(layout: LayoutId, photos: boolean): Slide {
  const content = structuredClone(SAMPLES[layout])
  if (!photos && content.image) delete content.image.url
  return { id: `sample-${layout}`, layout, content }
}

const DECK_TITLE = 'Pulse · Seed deck'

export default function Gallery() {
  const [params, setParams] = useSearchParams()
  const themeId = params.get('theme') ?? THEMES[0].id
  const view = params.get('view') ?? 'layouts'
  const photos = params.get('photos') !== '0'
  const native = params.get('native') === '1'
  const only = params.get('layout') as LayoutId | null
  const theme = getTheme(themeId)
  const layouts = only ? [only] : LAYOUT_IDS
  const slides = useMemo(() => layouts.map((l) => sampleSlide(l, photos)), [layouts, photos])
  const [exporting, setExporting] = useState(false)

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    p.set(k, v)
    setParams(p, { replace: true })
  }

  // Native 1280×720 rendering for screenshots / visual QA.
  if (native) {
    return (
      <div className="gal-native">
        {/* Used by tests/test_pptx_export.py to exercise the PPTX builder on every layout. */}
        <button
          data-testid="export-sample-pptx"
          style={{ position: 'fixed', right: 8, top: 8, zIndex: 10, opacity: 0.01 }}
          disabled={exporting}
          onClick={async () => {
            setExporting(true)
            const els = [...document.querySelectorAll<HTMLElement>('.gal-native-slide .sl')]
            const deck = { id: 'gallery', title: 'Gallery', themeId: theme.id, slides: slides.map((s) => ({ ...s, notes: `Notes for ${s.layout}` })) }
            download(await buildPptx(deck, theme, els), `gallery-${theme.id}.pptx`)
            setExporting(false)
          }}
        >
          export
        </button>
        {slides.map((s, i) => (
          <div key={s.id} id={`slide-${s.layout}`} className="gal-native-slide" data-layout={s.layout}>
            <SlideView slide={s} theme={theme} index={i} total={slides.length} deckTitle={DECK_TITLE} print />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="gal">
      <header className="gal-bar">
        <div className="gal-brand">
          <a href="/" aria-label="Aira home"><img className="gal-logo" src="/logo.png" alt="" /></a>
          <div>
            <div className="gal-title">Design system</div>
            <div className="gal-sub">{THEMES.length} themes × {LAYOUT_IDS.length} layouts</div>
          </div>
        </div>
        <div className="gal-tabs">
          <button className={view === 'layouts' ? 'on' : ''} onClick={() => set('view', 'layouts')}>Layouts</button>
          <button className={view === 'themes' ? 'on' : ''} onClick={() => set('view', 'themes')}>All themes</button>
        </div>
        <label className="gal-toggle">
          <input type="checkbox" checked={photos} onChange={(e) => set('photos', e.target.checked ? '1' : '0')} />
          Sample photos
        </label>
      </header>

      {view === 'layouts' && (
        <>
          <nav className="gal-themes">
            {THEMES.map((t) => (
              <button key={t.id} className={t.id === theme.id ? 'on' : ''} onClick={() => set('theme', t.id)} title={t.description}>
                <span className="sw" style={{ background: `linear-gradient(135deg, ${t.colors.bg} 0 45%, ${t.colors.primary} 45% 70%, ${t.colors.secondary} 70% 85%, ${t.colors.accent} 85%)` }} />
                {t.name}
              </button>
            ))}
          </nav>
          <p className="gal-desc">{theme.description}</p>
          <div className="gal-grid">
            {slides.map((s, i) => (
              <figure key={s.id} className="gal-item">
                <SlideCanvas slide={s} theme={theme} index={i} total={slides.length} deckTitle={DECK_TITLE} className="gal-canvas" />
                <figcaption>
                  <b>{LAYOUT_SPEC[s.layout].name}</b>
                  <span>{s.layout}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {view === 'themes' && (
        <div className="gal-theme-grid">
          {THEMES.map((t) => (
            <section key={t.id} className="gal-theme">
              <div className="gal-theme-head">
                <h3>{t.name}</h3>
                <button onClick={() => { const p = new URLSearchParams(params); p.set('view', 'layouts'); p.set('theme', t.id); setParams(p) }}>Open →</button>
              </div>
              <div className="gal-theme-row">
                {(['cover-hero', 'icon-grid-3', 'stats-big-numbers'] as LayoutId[]).map((l, i) => (
                  <SlideCanvas key={l} slide={sampleSlide(l, photos)} theme={t} index={i} total={3} deckTitle={DECK_TITLE} className="gal-canvas" />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
