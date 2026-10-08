import {
  ArrowLeft, Check, Copy, Download, History, Image as ImageIcon, LayoutTemplate, MessageSquare, Moon, MoreHorizontal, Palette, Play, Plus,
  Redo2, RefreshCw, Send, Sun, Trash2, TriangleAlert, Undo2, X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, streamGenerate, type Capabilities } from '../../api'
import { LAYOUT_SPEC, type Deck, type ImageRef, type LayoutId, type OutlineItem, type Slide } from '../../design/types'
import { SlideCanvas } from '../../slides/SlideCanvas'
import { uid, useEditor } from '../../store'
import { Brand, Menu, Spinner, deckTheme, toast, toastError, useAppTheme } from '../../ui'
import { ExportDialog, ImagePicker, LayoutPicker, ThemePopover, VersionsDialog } from './dialogs'
import { Presenter } from './Presenter'

interface ChatMsg {
  role: 'user' | 'ai' | 'sys'
  text: string
}

const SUGGESTIONS = ['Make this slide more visual', 'Add a slide about risks after this one', 'Make the tone more formal', 'Shorten all text', 'Switch to a dark theme']

export default function Editor() {
  const { id = '' } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const ed = useEditor()
  const { deck, current, busy, generating } = ed
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth > 860)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [dialog, setDialog] = useState<null | 'layout' | 'image' | 'export' | 'versions' | 'theme'>(null)
  const [presenting, setPresenting] = useState(false)
  const [overflow, setOverflow] = useState<Record<string, boolean>>({})
  const [drag, setDrag] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  /** Slides whose content came from the AI: overflow is fixed automatically (user-typed text is only flagged). */
  const autoFit = useRef<Map<string, number>>(new Map())
  const genStarted = useRef(false)

  const [appMode, toggleAppMode] = useAppTheme()
  const theme = deck ? deckTheme(deck) : null
  const slide = deck?.slides[current]

  // ---------------------------------------------------------------- load + generate
  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => {})
    const gen = (loc.state as { generate?: { title: string; outline: OutlineItem[] } } | null)?.generate
    if (gen && !genStarted.current) {
      genStarted.current = true
      nav(loc.pathname, { replace: true, state: null })
      runGeneration(gen.title, gen.outline)
      return
    }
    api.getDeck(id).then((d) => {
      ed.load(d)
      if (d.status === 'outline' && d.outline?.length && !genStarted.current) {
        genStarted.current = true
        runGeneration(d.title, d.outline)
      }
    }).catch((e) => toastError(e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function runGeneration(title: string, outline: OutlineItem[]) {
    ed.setGenerating(true)
    setMsgs([{ role: 'sys', text: `Writing ${outline.length} slides…` }])
    let finished = 0
    try {
      await streamGenerate(id, { title, outline }, (ev) => {
        if (ev.event === 'start') ed.load(ev.data.deck)
        else if (ev.event === 'slide') {
          const st = useEditor.getState()
          if (!st.deck) return
          const cur = st.deck.slides[ev.data.index]
          if (cur?.pending) finished++
          autoFit.current.set(ev.data.slide.id, 0)
          st.setSlide(ev.data.index, ev.data.slide, false)
        } else if (ev.event === 'error') toastError(ev.data.message)
        else if (ev.event === 'done') {
          const st = useEditor.getState()
          if (st.deck) st.commit({ ...st.deck, status: 'ready', slides: st.deck.slides.map((s) => ({ ...s, pending: false })) }, false)
        }
      })
      setMsgs((m) => [...m, { role: 'ai', text: `Your deck is ready: ${finished} slides. Click any text to edit it, or ask me for changes, e.g. "make slide 3 more visual".` }])
    } catch (e) {
      toastError(e)
    } finally {
      ed.setGenerating(false)
      useEditor.setState({ past: [], future: [] })
    }
  }

  // ---------------------------------------------------------------- autosave (debounced; every save is a version)
  const rev = ed.rev
  useEffect(() => {
    if (!deck || generating || rev === 0) return
    ed.setSaveState('saving')
    const t = setTimeout(async () => {
      try {
        await api.saveDeck(useEditor.getState().deck!)
        ed.setSaveState('saved')
      } catch {
        ed.setSaveState('error')
      }
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, generating])

  // ---------------------------------------------------------------- auto-fit: AI shortens overflowing AI-written slides
  const onFit = useCallback((s: Slide, fit: number, over: boolean) => {
    setOverflow((o) => (o[s.id] === over ? o : { ...o, [s.id]: over }))
    if (!over || s.pending) return
    const tries = autoFit.current.get(s.id)
    if (tries === undefined || tries >= 2 || useEditor.getState().busy[s.id]) return
    autoFit.current.set(s.id, tries + 1)
    const st = useEditor.getState()
    const index = st.deck?.slides.findIndex((x) => x.id === s.id) ?? -1
    if (index < 0) return
    st.setBusy(s.id, 'Fitting text…')
    api.fit(id, index, s, tries + 1)
      .then((r) => {
        const now = useEditor.getState()
        const i = now.deck?.slides.findIndex((x) => x.id === s.id) ?? -1
        if (i >= 0) now.setSlide(i, { ...r.slide, id: s.id }, false)
      })
      .catch(() => {})
      .finally(() => useEditor.getState().setBusy(s.id, null))
    void fit
  }, [id])

  // ---------------------------------------------------------------- slide actions
  async function regenerate(index: number, instruction?: string, layout?: LayoutId) {
    const d = useEditor.getState().deck
    if (!d) return
    const s = d.slides[index]
    ed.setBusy(s.id, layout ? 'Rewriting for the new layout…' : 'Regenerating…')
    try {
      const r = await api.regenerate(d, index, instruction, layout)
      autoFit.current.set(s.id, 0)
      const now = useEditor.getState()
      const i = now.deck!.slides.findIndex((x) => x.id === s.id)
      if (i >= 0) now.setSlide(i, { ...r.slide, id: s.id })
    } catch (e) {
      toastError(e)
    } finally {
      ed.setBusy(s.id, null)
    }
  }

  async function addSlide(after: number) {
    const d = useEditor.getState().deck
    if (!d) return
    const s: Slide = { id: uid(), layout: 'icon-grid-3', content: { title: 'New slide' }, notes: '' }
    const slides = [...d.slides]
    slides.splice(after + 1, 0, s)
    ed.commit({ ...d, slides })
    ed.select(after + 1)
    await regenerate(after + 1, 'Write a new slide that naturally continues the story from the previous slide and adds something new. Choose a fitting title.')
  }

  async function sendChat(text = input) {
    const d = useEditor.getState().deck
    if (!d || !text.trim() || sending) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setSending(true)
    try {
      const r = await api.chatEdit(d, text, useEditor.getState().current)
      r.changed.forEach((sid) => autoFit.current.set(sid, 0))
      ed.commit(r.deck)
      setMsgs((m) => [...m, { role: 'ai', text: r.reply }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e instanceof Error ? e.message : 'Something went wrong.' }])
    } finally {
      setSending(false)
    }
  }

  function pickLayout(l: LayoutId, needsAi: boolean) {
    setDialog(null)
    if (needsAi) regenerate(current, `Rewrite this slide for the ${LAYOUT_SPEC[l].name} layout, keeping its message.`, l)
    else ed.changeLayout(current, l)
  }

  function pickImage(img: ImageRef | null) {
    setDialog(null)
    if (!slide) return
    const prev = slide.content.image ?? {}
    const image = img ? { ...prev, ...img } : { query: prev.query, alt: prev.alt }
    ed.setSlide(current, { ...slide, content: { ...slide.content, image } })
  }

  // ---------------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
      const mod = e.ctrlKey || e.metaKey
      const st = useEditor.getState()
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        st.redo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (st.deck) api.saveDeck(st.deck, 'manual save').then(() => toast('Saved'))
      } else if (mod && e.key.toLowerCase() === 'd' && !typing) {
        e.preventDefault()
        st.duplicate(st.current)
      } else if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
        e.preventDefault()
        st.select(st.current + 1)
      } else if (!typing && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        st.select(st.current - 1)
      } else if (!typing && (e.key === 'F5' || (e.key === 'p' && !mod))) {
        e.preventDefault()
        setPresenting(true)
      } else if (!typing && e.key === 'Delete' && e.shiftKey) {
        st.remove(st.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // keep the active thumbnail in view
  useEffect(() => {
    document.querySelector(`[data-thumb="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [current])

  if (!deck || !theme) {
    return <div className="loading-block" style={{ height: '100dvh', justifyContent: 'center' }}><Spinner size={24} /><div className="serif">Opening your deck</div></div>
  }

  const hasImage = slide && 'image' in LAYOUT_SPEC[slide.layout].fields
  const slideBusy = slide ? busy[slide.id] : undefined
  const pendingCount = deck.slides.filter((s) => s.pending).length

  return (
    <div className="ed">
      {/* ------------------------------------------------ toolbar */}
      <header className="ed-bar">
        <button className="btn btn-ghost btn-icon" onClick={() => nav('/')} title="All presentations" aria-label="Back to home"><ArrowLeft size={18} /></button>
        <span className="hide-sm"><Brand compact /></span>
        <span className="sep" />
        <input className="deck-name" aria-label="Presentation title" defaultValue={deck.title} key={deck.title} onBlur={(e) => ed.rename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <span className="save-state hide-sm" aria-live="polite">
          {generating ? <><Spinner size={13} /> Writing {deck.slides.length - pendingCount}/{deck.slides.length}</> : ed.saveState === 'saving' ? <><Spinner size={13} /> Saving</> : ed.saveState === 'error' ? 'Save failed' : <><Check size={13} /> Saved</>}
        </span>
        {generating && <span className="show-sm"><Spinner size={16} /></span>}
        <span className="spacer" />
        <div className="group hide-sm">
          <button className="btn btn-ghost btn-icon" onClick={ed.undo} disabled={!ed.past.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={18} /></button>
          <button className="btn btn-ghost btn-icon" onClick={ed.redo} disabled={!ed.future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 size={18} /></button>
        </div>
        <span className="sep" />
        <div className="group">
          <button className="btn btn-ghost" onClick={() => setChatOpen(!chatOpen)} title="AI assistant" aria-label="AI assistant" aria-pressed={chatOpen}>
            <MessageSquare size={17} /> <span className="lbl lbl-md">Assistant</span>
          </button>
          <div className="rel">
            <button className="btn btn-ghost" data-theme-btn onClick={() => setDialog(dialog === 'theme' ? null : 'theme')} title="Theme" aria-label="Theme">
              <Palette size={17} /> <span className="lbl lbl-md">Theme</span>
            </button>
            {dialog === 'theme' && (
              <ThemePopover current={theme.id} onClose={() => setDialog(null)} onPick={(t) => { ed.setTheme(t.id, t.custom ? t : undefined); setDialog(null) }} />
            )}
          </div>
          <button className="btn btn-ghost btn-icon hide-sm" onClick={() => setDialog('versions')} title="Version history" aria-label="Version history"><History size={18} /></button>
          <button className="btn btn-ghost btn-icon hide-sm" onClick={toggleAppMode} title="Toggle dark / light" aria-label="Toggle dark or light mode">
            {appMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="show-sm">
            <Menu label="More actions" icon={<MoreHorizontal size={19} />}>
              {(close) => (
                <>
                  <button className="menu-item" disabled={!ed.past.length} onClick={() => { ed.undo(); close() }}><Undo2 size={17} /> Undo</button>
                  <button className="menu-item" disabled={!ed.future.length} onClick={() => { ed.redo(); close() }}><Redo2 size={17} /> Redo</button>
                  <button className="menu-item" disabled={generating} onClick={() => { setPresenting(true); close() }}><Play size={17} /> Present</button>
                  <button className="menu-item" onClick={() => { setDialog('versions'); close() }}><History size={17} /> Version history</button>
                  <button className="menu-item" onClick={() => { toggleAppMode(); close() }}>{appMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />} {appMode === 'dark' ? 'Light mode' : 'Dark mode'}</button>
                </>
              )}
            </Menu>
          </span>
        </div>
        <span className="sep" />
        <div className="group" style={{ gap: 8 }}>
          <button className="btn hide-sm" onClick={() => setPresenting(true)} disabled={generating} title="Present (P)" aria-label="Present"><Play size={16} /> <span className="lbl">Present</span></button>
          <button className="btn btn-primary" onClick={() => setDialog('export')} disabled={generating} data-testid="open-export" title="Download" aria-label="Download"><Download size={16} /> <span className="lbl">Download</span></button>
        </div>
      </header>

      <div className={'ed-body' + (chatOpen ? '' : ' chat-closed')}>
        <div className="chat-backdrop" onClick={() => setChatOpen(false)} />
        {/* ------------------------------------------------ chat */}
        <aside className="chat" aria-label="AI assistant">
          <div className="chat-head">
            <h4>Assistant</h4>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setChatOpen(false)} title="Close assistant" aria-label="Close assistant"><X size={17} /></button>
          </div>
          <div className="chat-log">
            {msgs.length === 0 && <div className="msg sys">Ask for any change: rewrite, add or remove slides, change tone or theme.</div>}
            {msgs.map((m, i) => (
              <div key={i} className={'msg ' + m.role}>{m.text}</div>
            ))}
            {sending && <div className="msg ai typing"><Spinner size={14} /></div>}
          </div>
          <div className="chat-sugg">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="pill" onClick={() => sendChat(s)} disabled={sending || generating}>{s}</button>
            ))}
          </div>
          <div className="chat-input">
            <textarea
              placeholder={`Tell Aira what to change (slide ${current + 1} is open)…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChat()
                }
              }}
              disabled={generating}
              data-testid="chat-input"
            />
            <button className="btn btn-primary btn-icon" onClick={() => sendChat()} disabled={sending || generating || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </div>
        </aside>

        {/* ------------------------------------------------ stage */}
        <main className="stage">
          <div className="stage-canvas">
            {slide && (
              <div className="stage-frame">
                {slide.pending ? (
                  <div className="canvas" style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
                    <div className="skel" />
                    <div className="skel-lines"><span /><span /><span /><span /></div>
                    <div className="skel-label"><Spinner size={13} /> Writing “{slide.content.title}”…</div>
                  </div>
                ) : (
                  <SlideCanvas
                    className="canvas"
                    slide={slide}
                    theme={theme}
                    index={current}
                    total={deck.slides.length}
                    deckTitle={deck.title}
                    editable={!slideBusy}
                    onEdit={(p, v) => ed.editField(current, p, v)}
                    onImageClick={() => setDialog('image')}
                  />
                )}
                {slideBusy && <div className="stage-busy"><div><Spinner /> {slideBusy}</div></div>}
              </div>
            )}
          </div>

          {slide && (
            <div className="stage-under">
              <div className="slide-tools">
                <div className="group">
                  <button className="btn btn-ghost btn-sm" onClick={() => setDialog('layout')} title="Change layout" aria-label="Change layout" disabled={!!slideBusy || slide.pending}><LayoutTemplate size={16} /> <span className="lbl">{LAYOUT_SPEC[slide.layout].name}</span></button>
                  {hasImage && <button className="btn btn-ghost btn-sm" onClick={() => setDialog('image')} title="Swap image" aria-label="Swap image" disabled={!!slideBusy || slide.pending}><ImageIcon size={16} /> <span className="lbl">Image</span></button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => regenerate(current)} disabled={!!slideBusy || slide.pending || generating} title="Regenerate this slide" aria-label="Regenerate"><RefreshCw size={16} /> <span className="lbl">Regenerate</span></button>
                </div>
                <div className="group">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => ed.duplicate(current)} title="Duplicate (Ctrl+D)" aria-label="Duplicate slide" disabled={slide.pending}><Copy size={16} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon btn-danger" onClick={() => ed.remove(current)} title="Delete (Shift+Del)" aria-label="Delete slide" disabled={deck.slides.length <= 1}><Trash2 size={16} /></button>
                </div>
                {overflow[slide.id] && !slideBusy && (
                  <div className="group">
                    <button className="btn btn-ghost btn-sm warn" onClick={() => { autoFit.current.set(slide.id, 0); onFit(slide, 0, true) }}>
                      <TriangleAlert size={16} /> Fix overflow
                    </button>
                  </div>
                )}
              </div>
              <div className="notes">
                <textarea aria-label="Speaker notes" placeholder="Speaker notes…" value={slide.notes ?? ''} onChange={(e) => ed.setNotes(current, e.target.value)} disabled={slide.pending} />
              </div>
            </div>
          )}

          {/* ------------------------------------------------ thumbnails */}
          <div className="strip">
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                data-thumb={i}
                className={'thumb' + (i === current ? ' on' : '') + (dragOver === i && drag !== i ? ' over' : '')}
                onClick={() => ed.select(i)}
                draggable={!generating}
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
                onDragEnd={() => { setDrag(null); setDragOver(null) }}
                onDrop={() => { if (drag !== null) ed.move(drag, i); setDrag(null); setDragOver(null) }}
              >
                <div className="t-canvas">
                  {s.pending ? (
                    <div style={{ aspectRatio: '16/9', position: 'relative' }}><div className="skel" /></div>
                  ) : (
                    <SlideCanvas slide={s} theme={theme} index={i} total={deck.slides.length} deckTitle={deck.title} print onFit={(f, o) => onFit(s, f, o)} />
                  )}
                </div>
                <span className="t-num">{i + 1}</span>
                {busy[s.id] ? <span className="t-warn" style={{ background: 'var(--app-accent)' }}>…</span> : overflow[s.id] && !s.pending && <span className="t-warn">!</span>}
              </div>
            ))}
            <button className="thumb-add" onClick={() => addSlide(current)} disabled={generating} title="Add an AI-written slide after the current one"><Plus size={20} /></button>
          </div>
        </main>
      </div>

      {dialog === 'layout' && slide && <LayoutPicker slide={slide} theme={theme} onPick={pickLayout} onClose={() => setDialog(null)} />}
      {dialog === 'image' && slide && <ImagePicker image={slide.content.image} caps={caps} onPick={pickImage} onClose={() => setDialog(null)} />}
      {dialog === 'versions' && <VersionsDialog deck={deck} onRestore={(d: Deck) => { ed.commit({ ...d, id: deck.id }); toast('Version restored') }} onClose={() => setDialog(null)} />}
      {dialog === 'export' && <ExportDialog deck={deck} theme={theme} onClose={() => setDialog(null)} />}
      {presenting && <Presenter deck={deck} theme={theme} start={current} onClose={(at) => { setPresenting(false); ed.select(at) }} />}
    </div>
  )
}
