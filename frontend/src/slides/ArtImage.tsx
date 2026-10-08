import { useId, type ReactNode } from 'react'
import { alpha, hash, mix } from '../design/color'
import { ICONS } from '../design/iconMap'
import type { Theme } from '../design/types'

const KEYWORDS: [RegExp, string][] = [
  [/fit|gym|workout|exercise|sport|run/i, 'dumbbell'],
  [/health|medic|doctor|care|hospital/i, 'heart-pulse'],
  [/ai\b|artificial|machine learning|neural|brain|intelligen/i, 'brain'],
  [/quantum|atom|physic|particle|qubit/i, 'atom'],
  [/data|analytic|chart|metric|growth/i, 'chart-line'],
  [/money|finance|revenue|invest|fund|price|cost/i, 'dollar-sign'],
  [/team|people|community|customer|user|crowd/i, 'users'],
  [/security|privacy|safe|protect/i, 'shield-check'],
  [/cloud|server|infra/i, 'cloud'],
  [/code|software|develop|program/i, 'code'],
  [/nature|forest|tree|plant|green|eco|climate|sustain/i, 'leaf'],
  [/mountain|landscape|travel|adventure/i, 'mountain'],
  [/space|rocket|launch|startup/i, 'rocket'],
  [/idea|innovation|creative|insight/i, 'lightbulb'],
  [/world|global|earth|international/i, 'globe'],
  [/learn|school|education|student|universit/i, 'graduation-cap'],
  [/research|science|lab|experiment/i, 'flask-conical'],
  [/phone|mobile|app/i, 'smartphone'],
  [/food|restaurant|cook|meal/i, 'utensils'],
  [/goal|target|focus|strategy/i, 'target'],
]

export function guessIcon(text = ''): string {
  for (const [re, icon] of KEYWORDS) if (re.test(text)) return icon
  return 'sparkles'
}

type Variant = 'orbit' | 'bauhaus' | 'aurora' | 'landscape'

function pickVariant(theme: Theme, seed: string): Variant {
  const serif = ['Fraunces', 'DM Serif Display', 'Playfair Display', 'Cormorant Garamond', 'Instrument Serif', 'Lora'].includes(theme.fonts.heading)
  const pref: Variant[] =
    theme.mode === 'dark'
      ? ['aurora', 'orbit']
      : theme.radius <= 2
        ? ['bauhaus', 'orbit']
        : serif
          ? ['landscape', 'bauhaus']
          : ['orbit', 'aurora']
  return pref[hash(seed) % pref.length]
}

/** Theme-colored abstract illustration used when no photo is available. Never blank. */
export function ArtImage({ theme, seed, icon, query, variant }: { theme: Theme; seed: string; icon?: string; query?: string; variant?: Variant }) {
  const v = variant ?? pickVariant(theme, seed)
  const c = theme.colors
  const iconName = icon || guessIcon(query)
  const Ic = ICONS[iconName] || ICONS['sparkles']
  const id = 'a' + useId().replace(/:/g, '')
  const r = hash(seed + v)
  let svg: ReactNode
  let showIcon = true

  if (v === 'orbit') {
    svg = (
      <>
        <defs>
          <linearGradient id={id + 'g'} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.gradient.from} />
            {theme.gradient.via && <stop offset=".55" stopColor={theme.gradient.via} />}
            <stop offset="1" stopColor={theme.gradient.to} />
          </linearGradient>
          <radialGradient id={id + 'h'} cx="30%" cy="20%" r="80%">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="600" fill={`url(#${id}g)`} />
        <rect width="600" height="600" fill={`url(#${id}h)`} />
        <g fill="none" stroke="#fff" strokeOpacity=".28">
          {[90, 150, 215, 285, 360].map((rr) => (
            <circle key={rr} cx="300" cy="300" r={rr} strokeWidth={rr === 215 ? 1.6 : 1} strokeDasharray={rr === 285 ? '3 7' : undefined} />
          ))}
        </g>
        <circle cx={300 + 215 * Math.cos(r % 6)} cy={300 + 215 * Math.sin(r % 6)} r="14" fill={c.accent} />
        <circle cx={300 + 150 * Math.cos((r >> 3) % 6)} cy={300 + 150 * Math.sin((r >> 3) % 6)} r="8" fill="#fff" />
        <circle cx={300 + 285 * Math.cos((r >> 5) % 6)} cy={300 + 285 * Math.sin((r >> 5) % 6)} r="10" fill="#fff" fillOpacity=".7" />
        <rect x="236" y="236" width="128" height="128" rx="34" fill="#fff" fillOpacity=".16" stroke="#fff" strokeOpacity=".45" />
      </>
    )
  } else if (v === 'aurora') {
    const base = theme.mode === 'dark' ? mix(c.bg, c.surface, 0.5) : mix(c.surface, c.bg, 0.3)
    svg = (
      <>
        <defs>
          <filter id={id + 'b'} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="60" />
          </filter>
        </defs>
        <rect width="600" height="600" fill={base} />
        <g filter={`url(#${id}b)`}>
          <circle cx={150 + (r % 80)} cy="170" r="190" fill={c.primary} fillOpacity=".85" />
          <circle cx="470" cy={380 + (r % 60)} r="200" fill={c.secondary} fillOpacity=".75" />
          <circle cx="260" cy="520" r="140" fill={c.accent} fillOpacity=".6" />
        </g>
        <g stroke={theme.mode === 'dark' ? '#fff' : c.text} strokeOpacity=".08">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="600" />
          ))}
        </g>
        <rect x="226" y="226" width="148" height="148" rx="40" fill="#fff" fillOpacity={theme.mode === 'dark' ? 0.1 : 0.45} stroke="#fff" strokeOpacity=".5" />
      </>
    )
  } else if (v === 'bauhaus') {
    showIcon = false
    const pal = [c.primary, c.secondary, c.accent, theme.mode === 'dark' ? c.text : c.text, mix(c.bg, c.text, 0.08)]
    const cells: ReactNode[] = []
    const n = 3
    const s = 600 / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const k = (r >> ((i * n + j) * 2)) % 6
        const x = i * s
        const y = j * s
        const f = pal[(i + j * 2 + (r % 5)) % pal.length]
        const bgc = pal[(i * 2 + j + 3 + (r % 3)) % pal.length]
        const rot = ((r >> (i + j)) % 4) * 90
        const t = `rotate(${rot} ${x + s / 2} ${y + s / 2})`
        cells.push(<rect key={`b${i}${j}`} x={x} y={y} width={s} height={s} fill={bgc === f ? pal[4] : bgc} />)
        if (k === 0) cells.push(<circle key={`s${i}${j}`} cx={x + s / 2} cy={y + s / 2} r={s * 0.36} fill={f} />)
        else if (k === 1) cells.push(<path key={`s${i}${j}`} transform={t} d={`M${x} ${y + s} A ${s} ${s} 0 0 1 ${x + s} ${y} L ${x + s} ${y + s} Z`} fill={f} />)
        else if (k === 2) cells.push(<path key={`s${i}${j}`} transform={t} d={`M${x} ${y + s / 2} A ${s / 2} ${s / 2} 0 0 1 ${x + s} ${y + s / 2} Z`} fill={f} />)
        else if (k === 3) cells.push(<polygon key={`s${i}${j}`} transform={t} points={`${x},${y + s} ${x + s},${y + s} ${x},${y}`} fill={f} />)
        else if (k === 4) cells.push(<circle key={`s${i}${j}`} cx={x + s / 2} cy={y + s / 2} r={s * 0.36} fill="none" stroke={f} strokeWidth={s * 0.12} />)
        else cells.push(<rect key={`s${i}${j}`} x={x + s * 0.2} y={y + s * 0.2} width={s * 0.6} height={s * 0.6} fill={f} />)
      }
    svg = <>{cells}</>
  } else {
    // landscape: layered hills under a sun
    const sky = theme.mode === 'dark' ? mix(c.bg, c.primary, 0.25) : mix(c.bg, c.accent, 0.25)
    const layers = [mix(c.secondary, c.bg, 0.45), mix(c.primary, c.bg, 0.35), c.primary, mix(c.primary, '#000000', 0.25)]
    svg = (
      <>
        <defs>
          <linearGradient id={id + 's'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky} />
            <stop offset="1" stopColor={mix(sky, c.accent, 0.35)} />
          </linearGradient>
        </defs>
        <rect width="600" height="600" fill={`url(#${id}s)`} />
        <circle cx={380 + (r % 80)} cy="220" r="78" fill={c.accent} />
        {layers.map((col, i) => {
          const y = 300 + i * 70
          const a = 40 + ((r >> i) % 30)
          return <path key={i} d={`M0 ${y} C 150 ${y - a}, 250 ${y + a}, 400 ${y - a / 2} S 560 ${y - a}, 600 ${y} V600 H0 Z`} fill={col} />
        })}
      </>
    )
    showIcon = false
  }

  return (
    <div className="art" data-pptx="image" data-art={v} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }}>
        {svg}
      </svg>
      {showIcon && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: v === 'aurora' && theme.mode === 'light' ? c.text : '#fff' }}>
          <Ic size={64} strokeWidth={1.5} style={{ filter: `drop-shadow(0 6px 18px ${alpha('#000', 0.18)})` }} />
        </div>
      )}
    </div>
  )
}
