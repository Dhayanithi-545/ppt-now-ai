import { useId, type CSSProperties, type ReactNode } from 'react'
import { alpha, hash, mix, readableOn } from '../design/color'
import { heroFillColor } from '../design/themeVars'
import type { Theme } from '../design/types'

const W = 1280
const H = 720

export function grainUrl(light: boolean, opacity = 0.5): string {
  const v = light ? 0 : 1
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 ${opacity} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`
  return `url("data:image/svg+xml;utf8,${svg}")`
}

interface DecorProps {
  theme: Theme
  hero: boolean
  inverse: boolean
  seed: number
  /** Full-bleed photo for photo-led themes. */
  photo?: string
}

const abs: CSSProperties = { position: 'absolute', inset: 0 }

/** Decorative background layer (gets rasterized as the PPTX slide background). */
export function Decor({ theme, hero, inverse, seed, photo }: DecorProps) {
  const c = theme.colors
  const fill = inverse ? heroFillColor(theme) : null
  const ink = fill ? readableOn(fill, [c.onPrimary, c.bg, c.text, '#FFFFFF', '#0A0A0A']) : c.text
  const base = fill ?? c.bg
  const light = theme.mode === 'light'
  const layers: ReactNode[] = []

  // ---------- base ----------
  const baseStyle: CSSProperties = { ...abs, background: inverse && theme.heroFill === 'gradient' ? `linear-gradient(${theme.gradient.angle}deg, ${theme.gradient.from}, ${theme.gradient.via ?? theme.gradient.to} 55%, ${theme.gradient.to})` : base }
  layers.push(<div key="base" style={baseStyle} />)

  // ---------- background style ----------
  const bg = theme.background === 'photo' && !(hero && photo) ? 'mesh' : theme.background
  if (bg === 'photo' && photo) {
    layers.push(
      <div key="photo" style={{ ...abs, backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />,
      <div key="photo-ov" style={{ ...abs, background: `linear-gradient(100deg, ${alpha(c.bg, 0.92)} 0%, ${alpha(c.bg, 0.7)} 45%, ${alpha(c.bg, 0.15)} 100%)` }} />,
    )
  } else if (bg === 'mesh') {
    layers.push(<Mesh key="mesh" theme={theme} hero={hero} inverse={inverse} seed={seed} ink={ink} />)
  } else if (bg === 'blobs') {
    layers.push(<Blobs key="blobs" theme={theme} hero={hero} inverse={inverse} seed={seed} ink={ink} />)
  } else if (bg === 'geometric') {
    layers.push(<Geometric key="geo" theme={theme} hero={hero} inverse={inverse} seed={seed} ink={ink} />)
  } else if (bg === 'grain' && hero && !inverse) {
    layers.push(
      <div key="grain-glow" style={{ ...abs, background: `radial-gradient(60% 90% at ${seed % 2 ? 12 : 88}% 100%, ${alpha(c.accent, 0.22)}, transparent 70%)` }} />,
    )
  }

  // ---------- motif ----------
  layers.push(<Motif key="motif" theme={theme} hero={hero} inverse={inverse} seed={seed} ink={ink} />)

  // ---------- grain overlay ----------
  if (theme.background === 'grain' || theme.background === 'mesh' || (theme.background === 'blobs' && !light)) {
    const op = theme.background === 'grain' ? (light ? 0.14 : 0.2) : 0.1
    layers.push(<div key="grain" style={{ ...abs, backgroundImage: grainUrl(light && !inverse, 0.55), opacity: op, mixBlendMode: light ? 'multiply' : 'screen' }} />)
  }
  return <div className="sl-bg" data-layer="bg">{layers}</div>
}

interface PartProps {
  theme: Theme
  hero: boolean
  inverse: boolean
  seed: number
  ink: string
}

function Mesh({ theme, hero, inverse, seed }: PartProps) {
  const c = theme.colors
  const dark = theme.mode === 'dark'
  const v = seed % 3
  const pos = [
    [[85, 8], [6, 96], [60, 70]],
    [[12, 10], [92, 90], [45, 40]],
    [[95, 55], [20, 0], [10, 95]],
  ][v]
  const k = inverse ? 0.5 : 1
  const a = hero ? [dark ? 0.62 : 0.4, dark ? 0.5 : 0.32, dark ? 0.3 : 0.22] : [dark ? 0.32 : 0.16, dark ? 0.2 : 0.1, 0]
  const g = [
    `radial-gradient(${hero ? '55% 75%' : '45% 60%'} at ${pos[0][0]}% ${pos[0][1]}%, ${alpha(c.primary, a[0] * k)}, transparent 70%)`,
    `radial-gradient(${hero ? '50% 70%' : '35% 50%'} at ${pos[1][0]}% ${pos[1][1]}%, ${alpha(c.secondary, a[1] * k)}, transparent 70%)`,
  ]
  if (a[2]) g.push(`radial-gradient(40% 50% at ${pos[2][0]}% ${pos[2][1]}%, ${alpha(c.accent, a[2] * k)}, transparent 70%)`)
  return <div style={{ ...abs, background: g.join(',') }} />
}

function Blobs({ theme, hero, inverse, seed, ink }: PartProps) {
  const c = theme.colors
  const light = theme.mode === 'light'
  const v = seed % 4
  const layouts = [
    [[980, -160, 520], [-160, 440, 460], [520, 520, 300]],
    [[-140, -180, 500], [960, 380, 520], [700, -120, 260]],
    [[880, -200, 560], [140, 520, 380], [-200, 80, 300]],
    [[-120, 380, 520], [1000, -120, 420], [560, -220, 300]],
  ][v]
  const cols = inverse ? [ink, c.accent, ink] : [c.primary, c.secondary, c.accent]
  const op = inverse ? [0.1, 0.25, 0.08] : hero ? (light ? [0.34, 0.38, 0.32] : [0.5, 0.42, 0.3]) : light ? [0.16, 0.18, 0] : [0.28, 0.2, 0]
  return (
    <>
      {layouts.map(([x, y, r], i) =>
        op[i] && (hero || i < 2) ? (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, width: hero ? r : r * 0.8, height: hero ? r : r * 0.8,
              borderRadius: '50%', background: cols[i], opacity: op[i], filter: `blur(${hero ? 70 : 80}px)`,
            }}
          />
        ) : null,
      )}
    </>
  )
}

function Geometric({ theme, hero, inverse, ink }: PartProps) {
  const uid = useId().replace(/:/g, '')
  const c = theme.colors
  const dark = theme.mode === 'dark' && !inverse
  if (dark) {
    // Synthwave-style perspective grid horizon.
    const lines: ReactNode[] = []
    const hy = hero ? 470 : 600
    const vx = 640
    for (let i = -14; i <= 14; i++) {
      lines.push(<line key={'v' + i} x1={vx + i * 18} y1={hy} x2={vx + i * 150} y2={H} />)
    }
    for (let k = 1; k < 9; k++) {
      const y = hy + (k * k * (H - hy)) / 64
      lines.push(<line key={'h' + k} x1={0} y1={y} x2={W} y2={y} />)
    }
    return (
      <svg style={abs} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gf${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.primary} stopOpacity="0" />
            <stop offset="1" stopColor={c.primary} stopOpacity={hero ? 0.55 : 0.28} />
          </linearGradient>
          <radialGradient id={`gl${uid}`} cx="50%" cy="100%" r="60%">
            <stop offset="0" stopColor={c.secondary} stopOpacity={hero ? 0.35 : 0.12} />
            <stop offset="1" stopColor={c.secondary} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y={hy - 260} width={W} height={260} fill={`url(#gl${uid})`} />
        <g stroke={`url(#gf${uid})`} strokeWidth="1.2">{lines}</g>
        {hero && <line x1="0" y1={hy} x2={W} y2={hy} stroke={c.primary} strokeOpacity=".5" />}
      </svg>
    )
  }
  const col = inverse ? ink : c.primary
  const col2 = inverse ? ink : c.secondary
  return (
    <svg style={abs} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {hero ? (
        <>
          <polygon points="760,0 1280,0 1280,720 1020,720" fill={col} fillOpacity={inverse ? 0.08 : 0.06} />
          <polygon points="980,0 1280,0 1280,430" fill={col2} fillOpacity={inverse ? 0.12 : 0.08} />
          <polygon points="1080,720 1280,520 1280,720" fill={c.accent} fillOpacity={inverse ? 0.9 : 0.8} />
          <line x1="700" y1="720" x2="1280" y2="140" stroke={col} strokeOpacity=".25" strokeWidth="1.5" />
          <line x1="760" y1="720" x2="1280" y2="200" stroke={col} strokeOpacity=".15" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <polygon points="1060,0 1280,0 1280,200" fill={col} fillOpacity=".07" />
          <polygon points="1170,0 1280,0 1280,96" fill={col} fillOpacity=".9" />
          <line x1="1010" y1="0" x2="1280" y2="250" stroke={col} strokeOpacity=".18" strokeWidth="1.2" />
        </>
      )}
    </svg>
  )
}

function Motif({ theme, hero, inverse, seed, ink }: PartProps) {
  const c = theme.colors
  const col = inverse ? ink : c.primary
  const r = hash(theme.id + seed)
  switch (theme.motif) {
    case 'orbs': {
      // Kept to the top-right corner: the one area no layout puts text in.
      const s = hero ? 360 : 200
      return (
        <div
          style={{
            position: 'absolute', left: W - s * (hero ? 0.62 : 0.55), top: -s * (hero ? 0.5 : 0.55), width: s, height: s, borderRadius: '50%',
            background: `linear-gradient(200deg, ${c.secondary} 0%, ${c.primary} 55%, ${mix(c.primary, c.bg, 0.6)} 100%)`,
            opacity: hero ? 0.85 : 0.45, boxShadow: `0 0 140px ${alpha(c.primary, 0.5)}`,
          }}
        />
      )
    }
    case 'grid': {
      const step = 80
      const lines: ReactNode[] = []
      for (let x = step; x < W; x += step) lines.push(<line key={'x' + x} x1={x} y1={0} x2={x} y2={H} />)
      for (let y = step; y < H; y += step) lines.push(<line key={'y' + y} x1={0} y1={y} x2={W} y2={y} />)
      return (
        <svg style={{ ...abs, maskImage: hero ? 'linear-gradient(110deg, transparent 30%, #000 85%)' : 'linear-gradient(200deg, #000 0%, transparent 38%)' }} viewBox={`0 0 ${W} ${H}`}>
          <g stroke={inverse ? ink : c.text} strokeOpacity={inverse ? 0.22 : 0.09} strokeWidth="1">{lines}</g>
          {!inverse && !hero && <rect x={W - 72 - 16} y={40} width={16} height={16} fill={c.primary} />}
        </svg>
      )
    }
    case 'dots': {
      const cols = hero ? 10 : 7
      const rows = hero ? 8 : 5
      const dots: ReactNode[] = []
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) dots.push(<circle key={i + '-' + j} cx={i * 22 + 4} cy={j * 22 + 4} r={2.6} />)
      return (
        <svg style={{ position: 'absolute', right: hero ? 80 : 56, top: hero ? 60 : 44, width: cols * 22, height: rows * 22, overflow: 'visible' }}>
          <g fill={col} fillOpacity={inverse ? 0.45 : 0.28}>{dots}</g>
        </svg>
      )
    }
    case 'rings': {
      const cx = seed % 2 ? W + 40 : -40
      const cy = hero ? H + 40 : -40
      const rings: ReactNode[] = []
      for (let k = 0; k < (hero ? 7 : 4); k++) rings.push(<circle key={k} cx={cx} cy={cy} r={140 + k * 80} />)
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`}>
          <g fill="none" stroke={inverse ? ink : c.accent} strokeOpacity={hero ? 0.28 : 0.14} strokeWidth="1.2">{rings}</g>
        </svg>
      )
    }
    case 'brackets': {
      const i = 28
      const l = hero ? 40 : 26
      const d = `M${i} ${i + l}V${i}H${i + l} M${W - i - l} ${i}H${W - i}V${i + l} M${W - i} ${H - i - l}V${H - i}H${W - i - l} M${i + l} ${H - i}H${i}V${H - i - l}`
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`}>
          <path d={d} fill="none" stroke={col} strokeOpacity={hero ? 0.9 : 0.55} strokeWidth="2" />
          {hero && (
            <g fill={col} fillOpacity=".6">
              <rect x={W / 2 - 1} y={i - 6} width={2} height={12} />
              <rect x={W / 2 - 6} y={i - 1} width={12} height={2} />
            </g>
          )}
        </svg>
      )
    }
    case 'stripes': {
      // Hero: a band hugging the bottom edge (below every layout's padding). Content: a small tag top-right.
      const w = hero ? 460 : 150
      const h = hero ? 40 : 36
      return (
        <div
          style={{
            position: 'absolute', right: hero ? 0 : 72, bottom: hero ? 0 : undefined, top: hero ? undefined : 40, width: w, height: h,
            backgroundImage: `repeating-linear-gradient(-45deg, ${inverse ? ink : c.text} 0 ${hero ? 10 : 6}px, transparent ${hero ? 10 : 6}px ${hero ? 20 : 12}px)`,
          }}
        />
      )
    }
    case 'frame': {
      const i = 24
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`}>
          <rect x={i} y={i} width={W - 2 * i} height={H - 2 * i} fill="none" stroke={col} strokeOpacity={hero ? 0.6 : 0.35} strokeWidth="1" />
          {hero && <rect x={i + 8} y={i + 8} width={W - 2 * i - 16} height={H - 2 * i - 16} fill="none" stroke={col} strokeOpacity=".22" strokeWidth="1" />}
          {hero && (
            <g fill={col} fillOpacity=".85">
              <rect x={W / 2 - 5} y={i - 5} width={10} height={10} transform={`rotate(45 ${W / 2} ${i})`} />
              <rect x={W / 2 - 5} y={H - i - 5} width={10} height={10} transform={`rotate(45 ${W / 2} ${H - i})`} />
            </g>
          )}
        </svg>
      )
    }
    case 'waves': {
      const paths: ReactNode[] = []
      const n = hero ? 9 : 5
      for (let k = 0; k < n; k++) {
        const y0 = (hero ? 470 : 600) + k * (hero ? 28 : 22)
        const amp = 26 + ((r >> k) % 18)
        const ph = (k * 37 + seed * 53) % 200
        paths.push(
          <path key={k} d={`M -50 ${y0} C ${200 - ph} ${y0 - amp}, ${420 + ph / 2} ${y0 + amp}, 660 ${y0} S ${1080 - ph / 3} ${y0 - amp}, 1330 ${y0 + amp / 2}`} />,
        )
      }
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <g fill="none" stroke={col} strokeOpacity={inverse ? 0.3 : 0.18} strokeWidth="1.4">{paths}</g>
        </svg>
      )
    }
    case 'confetti': {
      const cols = inverse ? [ink, c.primary, c.secondary] : [c.primary, c.secondary, c.accent]
      const spots = hero
        ? [[44, 44], [1236, 40], [1236, 680], [44, 676], [1240, 330], [40, 380], [520, 36], [760, 686]]
        : [[1236, 36], [1180, 30], [40, 684], [1240, 686]]
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`}>
          {spots.map(([x, y], k) => {
            const kind = (r >> (k * 3)) % 5
            const fill = cols[k % 3]
            const rot = ((r >> k) % 60) - 30
            const t = `rotate(${rot} ${x} ${y})`
            if (kind === 0) return <circle key={k} cx={x} cy={y} r={hero ? 13 : 9} fill={fill} />
            if (kind === 1) return <circle key={k} cx={x} cy={y} r={hero ? 13 : 9} fill="none" stroke={fill} strokeWidth={hero ? 5 : 3.5} />
            if (kind === 2) return <polygon key={k} transform={t} points={`${x},${y - 18} ${x + 16},${y + 12} ${x - 16},${y + 12}`} fill={fill} />
            if (kind === 3) return <path key={k} transform={t} d={`M${x - 26} ${y} q 8 -14 17 0 t 17 0 t 17 0`} fill="none" stroke={fill} strokeWidth={hero ? 6 : 4} strokeLinecap="round" />
            return <rect key={k} transform={t} x={x - 12} y={y - 12} width={24} height={24} rx={4} fill={fill} />
          })}
        </svg>
      )
    }
    case 'rules': {
      const x1 = 72
      const x2 = W - 72
      return (
        <svg style={abs} viewBox={`0 0 ${W} ${H}`}>
          <g stroke={inverse ? ink : c.text}>
            <line x1={x1} y1={34} x2={x2} y2={34} strokeWidth="2.5" strokeOpacity=".85" />
            <line x1={x1} y1={40} x2={x2} y2={40} strokeWidth="1" strokeOpacity=".5" />
            {hero && <line x1={x1} y1={H - 40} x2={x2} y2={H - 40} strokeWidth="1" strokeOpacity=".5" />}
          </g>
        </svg>
      )
    }
    default:
      return null
  }
}
