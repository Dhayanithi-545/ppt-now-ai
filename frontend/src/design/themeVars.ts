import type { CSSProperties } from 'react'
import { alpha, contrast, mix, readableOn } from './color'
import { fontStack } from './fonts'
import type { Theme } from './types'

export function gradientCss(t: Theme, angle = t.gradient.angle): string {
  const g = t.gradient
  return g.via
    ? `linear-gradient(${angle}deg, ${g.from} 0%, ${g.via} 50%, ${g.to} 100%)`
    : `linear-gradient(${angle}deg, ${g.from} 0%, ${g.to} 100%)`
}

/** Optical size corrections so every display font fills the same visual box. */
const HEADING_SCALE: Partial<Record<string, number>> = {
  'Cormorant Garamond': 1.16,
  'Instrument Serif': 1.14,
  'DM Serif Display': 1.02,
  'Archivo Black': 0.84,
  'Playfair Display': 1.0,
  Syne: 0.94,
}

export function seriesColors(t: Theme): string[] {
  const c = t.colors
  return t.series?.length ? t.series : [c.primary, c.secondary, c.accent, mix(c.primary, c.bg, 0.5)]
}

/** Shift `fg` toward `toward` until it reaches `min` contrast on `bg` (keeps hue where possible). */
export function ensureContrast(fg: string, bg: string, min: number, toward?: string): string {
  if (contrast(fg, bg) >= min) return fg
  const target = toward ?? readableOn(bg)
  for (let t = 0.1; t <= 1; t += 0.1) {
    const c = mix(fg, target, t)
    if (contrast(c, bg) >= min) return c
  }
  return target
}

/** Color used to draw a filled surface for hero slides (covers, dividers, closing). */
export function heroFillColor(t: Theme): string | null {
  const c = t.colors
  switch (t.heroFill) {
    case 'primary': return c.primary
    case 'secondary': return c.secondary
    case 'accent': return c.accent
    case 'gradient': return t.gradient.via ?? mix(t.gradient.from, t.gradient.to, 0.5)
    default: return null
  }
}

/** Overrides that turn a slide into an "inverse" hero (text sits on the brand fill). */
export function heroVars(t: Theme): Record<string, string> | null {
  const fill = heroFillColor(t)
  if (!fill) return null
  const c = t.colors
  const ink = readableOn(fill, [c.onPrimary, c.bg, c.text, '#FFFFFF', '#0A0A0A'])
  // A contrasting highlight that still reads on the fill.
  const pick = [c.accent, c.primary, c.secondary, c.bg].find((x) => x !== fill && contrast(x, fill) >= 3) ?? ink
  return {
    '--bg': fill,
    '--hero-bg': t.heroFill === 'gradient' ? gradientCss(t) : fill,
    '--text': ink,
    '--muted': alpha(ink, 0.78),
    '--border': alpha(ink, 0.22),
    '--primary-ink': pick,
    '--accent-ink': pick,
    '--secondary-ink': ink,
    '--primary-soft': alpha(ink, 0.12),
    '--grad': `linear-gradient(90deg, ${pick}, ${pick})`,
    '--card-bg': alpha(ink, 0.08),
    '--card-border': `1px solid ${alpha(ink, 0.25)}`,
    '--shadow': 'none',
    '--on-primary': fill,
  }
}

/** Theme tokens -> CSS custom properties on the slide root. */
export function themeVars(t: Theme): CSSProperties {
  const c = t.colors
  const dark = t.mode === 'dark'
  const border = mix(c.bg, c.text, dark ? 0.16 : 0.12)
  const shadow = {
    none: 'none',
    soft: dark
      ? '0 18px 50px -18px rgba(0,0,0,.6)'
      : `0 1px 2px ${alpha(c.text, 0.05)}, 0 14px 36px -12px ${alpha(mix(c.primary, c.text, 0.4), 0.22)}`,
    hard: `6px 6px 0 0 ${c.text}`,
    glow: `0 0 0 1px ${alpha(c.primary, 0.25)}, 0 20px 60px -20px ${alpha(c.primary, 0.55)}`,
  }[t.shadow]

  const cardBg = {
    filled: c.surface,
    outline: 'transparent',
    glass: dark ? alpha('#FFFFFF', 0.055) : alpha('#FFFFFF', 0.6),
    elevated: c.surface,
    brutal: c.surface,
  }[t.cardStyle]

  const cardBorder = {
    filled: '0px solid transparent',
    outline: `1px solid ${t.id === 'luxury' ? alpha(c.primary, 0.45) : border}`,
    glass: `1px solid ${dark ? alpha('#FFFFFF', 0.12) : alpha('#FFFFFF', 0.9)}`,
    elevated: `1px solid ${alpha(c.text, 0.06)}`,
    brutal: `2.5px solid ${c.text}`,
  }[t.cardStyle]

  const onPrimary = ensureContrast(c.onPrimary, c.primary, 4.5)
  const fillEnd = mix(c.primary, c.secondary, 0.3)
  const fill = contrast(onPrimary, fillEnd) >= 4.5 ? `linear-gradient(135deg, ${c.primary}, ${fillEnd})` : c.primary

  const vars: Record<string, string | number> = {
    '--fill': fill,
    '--on-accent': readableOn(c.accent, [c.text, c.bg, '#FFFFFF', '#0A0A0A']),
    '--primary-mid': alpha(c.primary, dark ? 0.38 : 0.3),
    '--zebra': alpha(c.text, dark ? 0.04 : 0.03),
    '--pill': `${Math.min(t.radius * 3, 999)}px`,
    '--bg': c.bg,
    '--surface': c.surface,
    '--primary': c.primary,
    '--secondary': c.secondary,
    '--accent': c.accent,
    '--text': c.text,
    '--muted': ensureContrast(c.muted, c.bg, 4.5, c.text),
    '--on-primary': onPrimary,
    '--primary-ink': ensureContrast(c.primary, c.bg, 3.2, c.text),
    '--secondary-ink': ensureContrast(c.secondary, c.bg, 3.2, c.text),
    '--accent-ink': ensureContrast(c.accent, c.bg, 3.2, c.text),
    '--text-strong': ensureContrast(c.text, c.bg, 7),
    '--muted-ink': ensureContrast(c.muted, c.bg, 4.5, c.text),
    '--hero-bg': c.bg,
    '--border': border,
    '--primary-soft': alpha(c.primary, dark ? 0.16 : 0.1),
    '--secondary-soft': alpha(c.secondary, dark ? 0.16 : 0.1),
    '--accent-soft': alpha(c.accent, dark ? 0.18 : 0.14),
    '--grad': gradientCss(t),
    '--grad-soft': `linear-gradient(${t.gradient.angle}deg, ${alpha(t.gradient.from, 0.16)}, ${alpha(t.gradient.to, 0.16)})`,
    '--font-h': fontStack(t.fonts.heading),
    '--h-scale': HEADING_SCALE[t.fonts.heading] ?? (t.fonts.headingUppercase ? 0.86 : 1),
    '--font-b': fontStack(t.fonts.body),
    '--h-weight': t.fonts.headingWeight,
    '--h-track': `${t.fonts.headingTracking}em`,
    '--h-case': t.fonts.headingUppercase ? 'uppercase' : 'none',
    '--radius': `${t.radius}px`,
    '--radius-sm': `${Math.round(t.radius * 0.55)}px`,
    '--shadow': shadow,
    '--card-bg': cardBg,
    '--card-border': cardBorder,
    '--good': dark ? '#4ADE80' : '#15803D',
    '--bad': dark ? '#F87171' : '#C2410C',
    '--good-soft': dark ? 'rgba(74,222,128,.14)' : 'rgba(21,128,61,.1)',
    '--bad-soft': dark ? 'rgba(248,113,113,.14)' : 'rgba(194,65,12,.1)',
  }
  return vars as CSSProperties
}
