import { Download, FileImage, FileText, RotateCcw, Search, Sparkles, Upload, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, download, type Capabilities, type ImageResult } from '../../api'
import { missingData, remapContent } from '../../design/remap'
import { LAYOUT_IDS, LAYOUT_SPEC, type Deck, type ImageRef, type LayoutId, type Slide, type Theme } from '../../design/types'
import { buildPptx } from '../../export/pptx'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { SlideView } from '../../slides/SlideView'
import { Modal, Spinner, allThemes, toast, toastError, useCustomThemes } from '../../ui'

// ------------------------------------------------------------------ layout picker

export function LayoutPicker({ slide, theme, onPick, onClose }: { slide: Slide; theme: Theme; onPick: (l: LayoutId, needsAi: boolean) => void; onClose: () => void }) {
  const groups = useMemo(() => {
    const g: Record<string, LayoutId[]> = {}
    for (const l of LAYOUT_IDS) (g[LAYOUT_SPEC[l].group] ??= []).push(l)
    return g
  }, [])
  return (
    <Modal title="Change layout" onClose={onClose} wide>
      <p className="hint" style={{ margin: '0 0 20px' }}>
        Previews use this slide's content. Layouts marked <b style={{ color: 'var(--app-accent)' }}>AI</b> need new data (a chart, table or more items), so Aira rewrites the slide for them.
      </p>
      {Object.entries(groups).map(([group, ids]) => (
        <div key={group} className="layout-group">
          <div className="label">{group}</div>
          <div className="layout-grid">
            {ids.map((l) => {
              const need = missingData(l, slide.content)
              const preview: Slide = { ...slide, id: slide.id + '-p-' + l, layout: l, content: remapContent(slide.content, l) }
              return (
                <button key={l} className={'layout-card' + (l === slide.layout ? ' on' : '')} onClick={() => onPick(l, !!need)}>
                  <SlideCanvas slide={need ? { ...preview, content: { ...preview.content, ...sampleFill(l) } } : preview} theme={theme} print />
                  <div className="lc-name">
                    <span>{LAYOUT_SPEC[l].name}</span>
                    {need && <span className="lc-ai">AI</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </Modal>
  )
}

function sampleFill(l: LayoutId) {
  if (l === 'chart-insight' || l === 'chart-full')
    return { chart: { type: 'bar' as const, categories: ['A', 'B', 'C', 'D'], series: [{ name: 'Value', values: [3, 5, 4, 7] }] }, items: [{ value: '+40%', text: 'Insight' }] }
  if (l === 'table') return { table: { headers: ['Item', 'Value'], rows: [['—', '—'], ['—', '—']] } }
  return {}
}

// ------------------------------------------------------------------ image picker

export function ImagePicker({ image, caps, onPick, onClose }: { image?: ImageRef; caps: Capabilities | null; onPick: (img: ImageRef | null) => void; onClose: () => void }) {
  const [q, setQ] = useState(image?.query ?? '')
  const [results, setResults] = useState<ImageResult[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  async function search() {
    if (!q.trim()) return
    setBusy('search')
    try {
      setResults((await api.searchImages(q)).results)
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }
  useEffect(() => {
    if (caps?.stockPhotos && q) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pickStock(r: ImageResult) {
    setBusy('pick')
    try {
      const { url } = await api.selectImage(r.url)
      onPick({ url, credit: r.credit, alt: r.alt, query: q })
    } catch (e) {
      toastError(e)
      setBusy(null)
    }
  }

  async function generate() {
    setBusy('gen')
    try {
      const r = await api.generateImage(q)
      onPick({ url: r.url, credit: r.credit, alt: q, query: q })
    } catch (e) {
      toastError(e)
      setBusy(null)
    }
  }

  async function upload(f: File) {
    setBusy('upload')
    try {
      const { url } = await api.uploadImage(f)
      onPick({ url, alt: f.name, query: q })
    } catch (e) {
      toastError(e)
      setBusy(null)
    }
  }

  return (
    <Modal title="Swap image" onClose={onClose} wide>
      <div className="img-tools">
        <input className="input" aria-label="Search photos" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search photos, e.g. runner at sunrise" />
        <button className="btn" onClick={search} disabled={!caps?.stockPhotos || !!busy} title={caps?.stockPhotos ? '' : 'Add UNSPLASH_ACCESS_KEY or PEXELS_API_KEY to .env to enable stock search'}>
          {busy === 'search' ? <Spinner /> : <Search size={15} />} Search
        </button>
        {caps?.imageGeneration && (
          <button className="btn" onClick={generate} disabled={!q.trim() || !!busy}>
            {busy === 'gen' ? <Spinner /> : <Wand2 size={15} />} Generate with AI
          </button>
        )}
        <button className="btn" onClick={() => file.current?.click()} disabled={!!busy}>
          {busy === 'upload' ? <Spinner /> : <Upload size={15} />} Upload
        </button>
        <button className="btn" onClick={() => onPick(null)} disabled={!!busy}>
          <Sparkles size={15} /> Use illustration
        </button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {!caps?.stockPhotos && (
        <p className="hint" style={{ marginTop: 14 }}>
          Stock photo search is off. Add <code>UNSPLASH_ACCESS_KEY</code> or <code>PEXELS_API_KEY</code> to <code>.env</code> to enable it. Uploads and theme illustrations always work.
        </p>
      )}
      <div className="img-grid">
        {results.map((r) => (
          <button key={r.url} onClick={() => pickStock(r)} disabled={!!busy} title={r.credit}>
            <img src={r.thumb} alt={r.alt} loading="lazy" />
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ theme popover

export function ThemePopover({ current, onPick, onClose }: { current: string; onPick: (t: Theme) => void; onClose: () => void }) {
  const custom = useCustomThemes()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    custom.load()
    const k = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-theme-btn]') && onClose()
    setTimeout(() => window.addEventListener('mousedown', k))
    return () => window.removeEventListener('mousedown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const sample: Slide = { id: 'tp', layout: 'cover-hero', content: { eyebrow: 'Theme', title: 'Aa Bb', subtitle: '' } }

  async function make() {
    setBusy(true)
    try {
      const { theme } = await api.themeFromPrompt(prompt.trim())
      custom.add(theme)
      onPick(theme)
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pop theme-pop" ref={ref}>
      <div className="pop-row">
        <input className="input" aria-label="Describe a custom style" placeholder="Describe a custom style…" value={prompt} maxLength={500} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && prompt.trim().length > 2 && make()} />
        <button className="btn" onClick={make} disabled={busy || prompt.trim().length < 3}>
          {busy ? <Spinner /> : <Wand2 size={15} />} Create
        </button>
      </div>
      <div className="theme-grid">
        {allThemes(custom.list).map((t) => (
          <button key={t.id} className={'theme-card' + (t.id === current ? ' on' : '')} onClick={() => onPick(t)}>
            <div className="tc-canvas">
              <SlideCanvas slide={{ ...sample, id: 'tp-' + t.id, content: { ...sample.content, eyebrow: t.name } }} theme={t} print />
            </div>
            <div className="tc-name">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ versions

export function VersionsDialog({ deck, onRestore, onClose }: { deck: Deck; onRestore: (d: Deck) => void; onClose: () => void }) {
  const [list, setList] = useState<{ id: number; note: string | null; created: number }[] | null>(null)
  useEffect(() => {
    api.versions(deck.id).then(setList).catch(toastError)
  }, [deck.id])
  return (
    <Modal title="Version history" onClose={onClose}>
      {!list ? (
        <Spinner />
      ) : !list.length ? (
        <p className="dim">No saved versions yet.</p>
      ) : (
        <div className="versions">
          {list.map((v) => (
            <div key={v.id} className="version-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.note || 'Edit'}</div>
                <div className="dim" style={{ fontSize: 12 }}>{new Date(v.created * 1000).toLocaleString()}</div>
              </div>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    onRestore(await api.version(deck.id, v.id))
                    onClose()
                  } catch (e) {
                    toastError(e)
                  }
                }}
              >
                <RotateCcw size={14} /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ export

/** All slides rendered offscreen at native 1280×720 (used by the PPTX builder). */
function ExportStage({ deck, theme, onReady }: { deck: Deck; theme: Theme; onReady: (els: HTMLElement[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      await document.fonts.ready
      const imgs = [...(ref.current?.querySelectorAll('img') ?? [])]
      await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))))
      await new Promise((r) => setTimeout(r, 400))
      if (alive && ref.current) onReady([...ref.current.querySelectorAll<HTMLElement>('.sl')])
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return createPortal(
    <div ref={ref} style={{ position: 'fixed', left: -20000, top: 0, width: 1280, pointerEvents: 'none' }} aria-hidden>
      {deck.slides.map((s, i) => (
        <div key={s.id} style={{ width: 1280, height: 720 }}>
          <SlideView slide={s} theme={theme} index={i} total={deck.slides.length} deckTitle={deck.title} print />
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function ExportDialog({ deck, theme, onClose, initial = 'pptx' }: { deck: Deck; theme: Theme; onClose: () => void; initial?: 'pptx' | 'pdf' }) {
  const [name, setName] = useState(deck.title || 'Presentation')
  const [fmt, setFmt] = useState<'pptx' | 'pdf'>(initial)
  const [safe, setSafe] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [stage, setStage] = useState(false)
  const filename = (name.trim() || 'Presentation').replace(/[\\/:*?"<>|]/g, '') + '.' + fmt

  async function go() {
    if (fmt === 'pdf') {
      setBusy('Rendering PDF…')
      try {
        download(await api.exportPdf(deck, filename), filename)
        toast('PDF downloaded')
        onClose()
      } catch (e) {
        toastError(e)
      } finally {
        setBusy(null)
      }
    } else {
      setBusy('Preparing slides…')
      setStage(true)
    }
  }

  async function onStageReady(els: HTMLElement[]) {
    try {
      const blob = await buildPptx(deck, theme, els, { safeFonts: safe, onProgress: (d, t) => setBusy(`Building slide ${d} of ${t}…`) })
      download(blob, filename)
      toast('PowerPoint downloaded')
      onClose()
    } catch (e) {
      toastError(e)
    } finally {
      setStage(false)
      setBusy(null)
    }
  }

  return (
    <Modal
      title="Download"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={!!busy}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={!!busy} data-testid="export-go">
            {busy ? <Spinner /> : <Download size={15} />} {busy ?? 'Download'}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>File name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} data-testid="export-name" />
          <span className="hint" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{filename}</span>
        </label>
        <div className="field">
          <span>Format</span>
          <div className="fmt-grid">
            <button className={'fmt-card' + (fmt === 'pptx' ? ' on' : '')} onClick={() => setFmt('pptx')} data-testid="fmt-pptx" aria-pressed={fmt === 'pptx'}>
              <FileImage size={22} />
              <span><b>PowerPoint</b>Editable text and native charts</span>
            </button>
            <button className={'fmt-card' + (fmt === 'pdf' ? ' on' : '')} onClick={() => setFmt('pdf')} data-testid="fmt-pdf" aria-pressed={fmt === 'pdf'}>
              <FileText size={22} />
              <span><b>PDF</b>Pixel-perfect, ready to share</span>
            </button>
          </div>
        </div>
        {fmt === 'pptx' && (
          <label className="toggle" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Use standard fonts (Arial / Georgia) for computers without {theme.fonts.heading} and {theme.fonts.body}</span>
          </label>
        )}
        {fmt === 'pptx' && !safe && (
          <p className="hint" style={{ margin: 0 }}>
            For an exact match in PowerPoint, install the free theme fonts:{' '}
            {[...new Set([theme.fonts.heading, theme.fonts.body])].map((f, i) => (
              <span key={f}>
                {i > 0 && ', '}
                <a href={`https://fonts.google.com/specimen/${f.replace(/ /g, '+')}`} target="_blank" rel="noreferrer">{f}</a>
              </span>
            ))}
            . Line breaks are preserved either way.
          </p>
        )}
      </div>
      {stage && <ExportStage deck={deck} theme={theme} onReady={onStageReady} />}
    </Modal>
  )
}

