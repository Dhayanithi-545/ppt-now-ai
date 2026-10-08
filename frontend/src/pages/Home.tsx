import { ArrowLeft, ArrowRight, GripVertical, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Capabilities, type ClarifyQuestion } from '../api'
import { LAYOUT_IDS, LAYOUT_SPEC, type Brief, type Deck, type LayoutId, type OutlineItem, type Slide, type Theme } from '../design/types'
import { SlideCanvas } from '../slides/SlideCanvas'
import { AppThemeButton, Brand, Spinner, allThemes, deckTheme, toast, toastError, useCustomThemes, useScrolled } from '../ui'

type Step = 'prompt' | 'clarify' | 'theme' | 'outline'

const EXAMPLES = [
  'Pitch deck for a new AI-powered fitness startup',
  'Introduction to quantum computing for college students',
  'Quarterly business review for a SaaS company',
  'The history of jazz in 10 slides',
  'Onboarding for new engineering hires',
  'Climate change: causes, impacts and solutions',
]
const TONES = ['Professional', 'Persuasive', 'Inspiring', 'Educational', 'Casual', 'Formal']

function coverSample(theme: Theme, title: string): Slide {
  return {
    id: 'preview-' + theme.id,
    layout: 'cover-hero',
    content: { eyebrow: theme.name, title: title || 'Your presentation title', subtitle: theme.description ?? '', meta: 'Aira · 2026' },
  }
}

export default function Home() {
  const nav = useNavigate()
  const scrolled = useScrolled()
  const [step, setStep] = useState<Step>('prompt')
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [brief, setBrief] = useState<Brief>({ prompt: '', slide_count: 10, language: 'English', tone: null, audience: null, research: false })
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [themeId, setThemeId] = useState('midnight')
  const [stylePrompt, setStylePrompt] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof api.listDecks>>>([])
  const custom = useCustomThemes()
  const themes = useMemo(() => allThemes(custom.list), [custom.list])
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]

  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => setCaps(null))
    api.listDecks().then(setRecent).catch(() => {})
    custom.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  const qa = () => questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' })).filter((a) => a.answer)

  async function start() {
    if (brief.prompt.trim().length < 3) return toast('Describe what the presentation is about')
    setBusy('Reading your request…')
    try {
      const r = await api.clarify(brief)
      if (r.needs_clarification && r.questions.length) {
        setQuestions(r.questions)
        setStep('clarify')
      } else setStep('theme')
    } catch {
      setStep('theme')
    } finally {
      setBusy(null)
    }
  }

  async function makeTheme() {
    if (stylePrompt.trim().length < 3) return
    setBusy('Designing your theme…')
    try {
      const { theme: t, fixes } = await api.themeFromPrompt(stylePrompt)
      custom.add(t)
      setThemeId(t.id)
      toast(fixes.length ? `Theme created (${fixes.length} contrast fix${fixes.length > 1 ? 'es' : ''} applied)` : 'Theme created')
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }

  async function makeOutline() {
    setStep('outline')
    setBusy(brief.research ? 'Researching the web and planning your story…' : 'Planning your story…')
    try {
      setDeck(await api.outline(brief, qa(), theme.id, theme.custom ? theme : undefined))
    } catch (e) {
      toastError(e)
      setStep('theme')
    } finally {
      setBusy(null)
    }
  }

  function generate() {
    if (!deck?.outline?.length) return
    nav(`/deck/${deck.id}`, { state: { generate: { title: deck.title, outline: deck.outline } } })
  }

  const order: Step[] = ['prompt', 'theme', 'outline']
  const at = order.indexOf(step === 'clarify' ? 'prompt' : step)

  return (
    <div className="home">
      <header className={'topbar' + (scrolled ? ' scrolled' : '')}>
        <Brand />
        {step !== 'prompt' && (
          <nav className="stepper hide-sm" aria-label="Progress">
            {(['Describe', 'Style', 'Outline'] as const).map((label, i) => (
              <span key={label} style={{ display: 'contents' }}>
                {i > 0 && <i />}
                <span className={'st' + (i === at ? ' on' : i < at ? ' done' : '')}>
                  <b>{i + 1}</b>
                  {label}
                </span>
              </span>
            ))}
          </nav>
        )}
        <div className="topbar-actions">
          <Link className="btn btn-ghost btn-sm hide-sm" to="/gallery">Design system</Link>
          <AppThemeButton />
        </div>
      </header>

      <main className="home-main">
        {/* ---------------------------------------------------------------- 1. describe */}
        {step === 'prompt' && (
          <>
            <section className="hero">
              <div className="eyebrow-app">AI presentations</div>
              <h1>
                Decks that look <em>designed</em>, ready in a minute.
              </h1>
              <p>Describe your topic. Aira plans the story, writes every slide and lays it out on a professional design system. Then refine anything with a click or a sentence.</p>
            </section>

            <div className="composer">
              <textarea
                autoFocus
                aria-label="What is your presentation about?"
                placeholder="What is your presentation about? Paste notes or an outline too…"
                value={brief.prompt}
                onChange={(e) => setBrief({ ...brief, prompt: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && start()}
              />
              <div className="composer-bar">
                <label className="field">
                  <span>Slides</span>
                  <select className="select" value={brief.slide_count} onChange={(e) => setBrief({ ...brief, slide_count: +e.target.value })}>
                    {[5, 6, 8, 10, 12, 15, 20].map((n) => (
                      <option key={n} value={n}>{n} slides</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Tone</span>
                  <select className="select" value={brief.tone ?? ''} onChange={(e) => setBrief({ ...brief, tone: e.target.value || null })}>
                    <option value="">Any tone</option>
                    {TONES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Audience</span>
                  <input className="input" placeholder="e.g. investors" value={brief.audience ?? ''} onChange={(e) => setBrief({ ...brief, audience: e.target.value || null })} />
                </label>
                <label className="field">
                  <span>Language</span>
                  <input className="input" placeholder="English" value={brief.language} onChange={(e) => setBrief({ ...brief, language: e.target.value || 'English' })} />
                </label>
                <div className="go">
                  <button className="btn btn-primary btn-lg" onClick={start} disabled={!!busy}>
                    {busy ? <Spinner /> : <Sparkles size={17} />} Continue
                  </button>
                </div>
              </div>
              <div className="composer-foot">
                {caps?.grounding ? (
                  <label className="toggle" title="Use Google Search for current facts and figures">
                    <input type="checkbox" checked={brief.research} onChange={(e) => setBrief({ ...brief, research: e.target.checked })} />
                    Research the web for current facts
                  </label>
                ) : (
                  <span />
                )}
                <span className="hint hide-sm">Ctrl + Enter to continue</span>
              </div>
            </div>

            <div className="examples">
              {EXAMPLES.map((e) => (
                <button key={e} className={'pill' + (brief.prompt === e ? ' on' : '')} onClick={() => setBrief({ ...brief, prompt: e })}>
                  {e}
                </button>
              ))}
            </div>

            {busy && (
              <div className="loading-block">
                <Spinner size={22} />
                {busy}
              </div>
            )}

            {recent.length > 0 && (
              <section className="recent">
                <div className="recent-head">
                  <h3>Recent work</h3>
                  <span className="dim" style={{ fontSize: 13 }}>{recent.length} presentation{recent.length > 1 ? 's' : ''}</span>
                </div>
                <div className="recent-grid">
                  {recent.map((d) => (
                    <Link key={d.id} to={`/deck/${d.id}`} className="recent-card">
                      <div className="rc-canvas">
                        {d.cover && !d.cover.pending ? (
                          <SlideCanvas slide={d.cover} theme={deckTheme(d)} print />
                        ) : (
                          <div className="rc-empty">
                            <span className="serif">{d.title}</span>
                            <span className="eyebrow-app">Outline only</span>
                          </div>
                        )}
                      </div>
                      <div className="rc-meta">
                        <div className="rc-title">{d.title}</div>
                        <div className="rc-sub">{d.slideCount} slides · {new Date(d.updated * 1000).toLocaleDateString()}</div>
                      </div>
                      <button
                        className="btn btn-sm btn-icon rc-del"
                        title="Delete presentation"
                        aria-label={`Delete ${d.title}`}
                        onClick={async (e) => {
                          e.preventDefault()
                          if (!confirm(`Delete "${d.title}"?`)) return
                          await api.deleteDeck(d.id)
                          setRecent(recent.filter((x) => x.id !== d.id))
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------------------------------------------------------------- clarify */}
        {step === 'clarify' && (
          <>
            <div className="section-head">
              <div>
                <div className="eyebrow-app">Step 1 of 3</div>
                <h2>A few quick questions</h2>
                <p>Answer what you like and skip the rest. Sensible defaults fill the gaps.</p>
              </div>
            </div>
            {questions.map((q, i) => (
              <div className="panel qa" key={i}>
                <h4>{q.question}</h4>
                <div className="chips">
                  {q.options.map((o) => (
                    <button key={o} className={'pill' + (answers[i] === o ? ' on' : '')} onClick={() => setAnswers({ ...answers, [i]: o })}>
                      {o}
                    </button>
                  ))}
                </div>
                <input className="input" placeholder="Or type your own answer" value={q.options.includes(answers[i]) ? '' : answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
              </div>
            ))}
            <div className="sticky-actions">
              <button className="btn" onClick={() => setStep('prompt')}><ArrowLeft size={16} /> Back</button>
              <button className="btn btn-primary" onClick={() => setStep('theme')}>Choose a style <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- 2. style */}
        {step === 'theme' && (
          <>
            <div className="section-head">
              <div>
                <div className="eyebrow-app">Step 2 of 3</div>
                <h2>Pick a style</h2>
                <p>Each theme is a complete design system. You can switch later without losing any content.</p>
              </div>
            </div>
            <div className="panel custom-theme">
              <Wand2 size={18} className="hide-sm" style={{ color: 'var(--app-accent)', flex: 'none' }} />
              <input
                className="input"
                aria-label="Describe your own style"
                placeholder='Describe your own style, e.g. "dark luxury with gold accents, editorial feel"'
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && makeTheme()}
              />
              <button className="btn" onClick={makeTheme} disabled={!!busy || stylePrompt.trim().length < 3}>
                {busy ? <Spinner /> : <Sparkles size={16} />} Generate theme
              </button>
            </div>
            <div className="theme-grid">
              {themes.map((t) => (
                <button key={t.id} className={'theme-card' + (t.id === themeId ? ' on' : '')} onClick={() => setThemeId(t.id)} aria-pressed={t.id === themeId}>
                  <div className="tc-canvas">
                    <SlideCanvas slide={coverSample(t, brief.prompt.slice(0, 54))} theme={t} print />
                  </div>
                  <div className="tc-name">
                    {t.name}
                    {t.custom && <span className="tag">Custom</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="sticky-actions">
              <button className="btn" onClick={() => setStep(questions.length ? 'clarify' : 'prompt')}><ArrowLeft size={16} /> Back</button>
              <button className="btn btn-primary" onClick={makeOutline}>Create outline <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- 3. outline */}
        {step === 'outline' && (
          <>
            {busy || !deck ? (
              <div className="loading-block">
                <Spinner size={26} />
                <div className="serif">Planning your story</div>
                <div>{busy}</div>
              </div>
            ) : (
              <OutlineEditor deck={deck} setDeck={setDeck} onBack={() => setStep('theme')} onGenerate={generate} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function OutlineEditor({ deck, setDeck, onBack, onGenerate }: { deck: Deck; setDeck: (d: Deck) => void; onBack: () => void; onGenerate: () => void }) {
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const outline = deck.outline ?? []
  const set = (o: OutlineItem[]) => setDeck({ ...deck, outline: o })
  const upd = (i: number, patch: Partial<OutlineItem>) => set(outline.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  return (
    <>
      <div className="section-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow-app">Step 3 of 3 · Outline</div>
          <input
            className="input serif"
            aria-label="Presentation title"
            style={{ fontSize: 'clamp(28px, 4vw, 42px)', height: 'auto', padding: '6px 12px', marginTop: 10, border: '1px solid transparent', background: 'transparent' }}
            value={deck.title}
            onChange={(e) => setDeck({ ...deck, title: e.target.value })}
          />
          <p>Review the story. Edit titles, change layouts and drag to reorder, then generate.</p>
        </div>
      </div>
      <div className="outline-list">
        {outline.map((o, i) => (
          <div
            key={i}
            className={'ol-row' + (drag === i ? ' dragging' : '') + (over === i && drag !== i ? ' over' : '')}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(i)
            }}
            onDragEnd={() => {
              setDrag(null)
              setOver(null)
            }}
            onDrop={() => {
              if (drag === null || drag === i) return
              const next = [...outline]
              const [m] = next.splice(drag, 1)
              next.splice(i, 0, m)
              set(next)
            }}
          >
            <span className="ol-handle" aria-hidden><GripVertical size={16} /></span>
            <span className="ol-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="ol-fields">
              <input className="input ol-title" aria-label={`Slide ${i + 1} title`} value={o.title} onChange={(e) => upd(i, { title: e.target.value })} />
              <input className="input ol-intent" aria-label={`Slide ${i + 1} intent`} value={o.intent} placeholder="What should this slide say?" onChange={(e) => upd(i, { intent: e.target.value })} />
            </div>
            <select className="select" aria-label={`Slide ${i + 1} layout`} value={o.layout} onChange={(e) => upd(i, { layout: e.target.value as LayoutId })}>
              {LAYOUT_IDS.map((l) => (
                <option key={l} value={l}>{LAYOUT_SPEC[l].name}</option>
              ))}
            </select>
            <div className="ol-actions">
              <button
                className="btn btn-ghost btn-icon btn-sm"
                title="Add slide after"
                aria-label="Add slide after"
                onClick={() => {
                  const n = [...outline]
                  n.splice(i + 1, 0, { title: 'New slide', layout: 'icon-grid-3', intent: '' })
                  set(n)
                }}
              >
                <Plus size={16} />
              </button>
              <button className="btn btn-ghost btn-icon btn-sm btn-danger" title="Remove slide" aria-label="Remove slide" disabled={outline.length <= 2} onClick={() => set(outline.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="sticky-actions">
        <button className="btn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary btn-lg" onClick={onGenerate}><Sparkles size={17} /> Generate {outline.length} slides</button>
      </div>
    </>
  )
}
