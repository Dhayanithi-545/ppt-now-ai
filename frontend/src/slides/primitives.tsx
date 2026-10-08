import type { CSSProperties, ElementType, KeyboardEvent, ReactNode } from 'react'
import { assetUrl } from '../config'
import { ICONS } from '../design/iconMap'
import { getPath, useSlide } from './context'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

function withHighlight(text: string, hl?: string): ReactNode {
  if (!hl) return text
  const i = text.toLowerCase().indexOf(hl.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <span className="hl">{text.slice(i, i + hl.length)}</span>
      {text.slice(i + hl.length)}
    </>
  )
}

interface TxtProps {
  /** Path into SlideContent, e.g. "title" or "items.2.text". */
  p: string
  as?: ElementType
  className?: string
  style?: CSSProperties
  placeholder?: string
  highlight?: string
  /** Auto-shrink this text (within limits) if it overflows its box. */
  fit?: boolean
}

/** A text field bound to the slide JSON. Click-to-edit in the editor, plain text elsewhere. */
export function Txt({ p, as: Tag = 'div', className, style, placeholder, highlight, fit }: TxtProps) {
  const { content, editable, onEdit } = useSlide()
  const raw = getPath(content, p)
  const value = raw == null ? '' : String(raw)
  if (!value && !editable) return null
  const common = {
    className: cx('t', className),
    style,
    'data-field': p,
    'data-pptx': 'text',
    'data-fit': fit ? '' : undefined,
  }
  if (!editable) return <Tag {...common}>{withHighlight(value, highlight)}</Tag>
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
    e.stopPropagation()
  }
  return (
    <Tag
      {...common}
      key={value}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder ?? 'Type…'}
      onKeyDown={onKeyDown}
      onBlur={(e: { currentTarget: HTMLElement }) => {
        const v = e.currentTarget.innerText.replace(/\s+\n/g, '\n').trim()
        if (v !== value) onEdit?.(p, v)
      }}
    >
      {value}
    </Tag>
  )
}

export function Icon({ name, size = 28, stroke = 1.75, className }: { name?: string; size?: number; stroke?: number; className?: string }) {
  const C = (name && ICONS[name]) || ICONS['sparkles']
  return (
    <span className={cx('ic', className)} data-pptx="icon" data-icon={name || 'sparkles'} style={{ width: size, height: size }}>
      <C size={size} strokeWidth={stroke} absoluteStrokeWidth={false} />
    </span>
  )
}

/** Icon inside a theme-styled chip (soft tint, gradient or outline depending on theme). */
export function IconChip({ name, size = 56, tone = 'primary' }: { name?: string; size?: number; tone?: 'primary' | 'secondary' | 'accent' | 'solid' }) {
  return (
    <span className={cx('chip', `chip-${tone}`)} style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.46)} />
    </span>
  )
}

export function Eyebrow({ p = 'eyebrow', className }: { p?: string; className?: string }) {
  const { content, theme, index, editable } = useSlide()
  const v = getPath(content, p)
  if (!v && !editable) return null
  const style = theme.eyebrowStyle
  return (
    <div className={cx('eyebrow', `eb-${style}`, className)}>
      {style === 'number' && <span className="eb-num">{String(index + 1).padStart(2, '0')}</span>}
      {style === 'line' && <span className="eb-line" />}
      {style === 'mono' && <span className="eb-mono">//</span>}
      <Txt p={p} as="span" placeholder="Eyebrow" />
    </div>
  )
}

/** Standard content-slide header: eyebrow, title, optional subtitle. */
export function Header({ subtitle = true, center, className }: { subtitle?: boolean; center?: boolean; className?: string }) {
  return (
    <header className={cx('hdr', center && 'hdr-center', className)}>
      <Eyebrow />
      <Txt p="title" as="h2" className="h2" fit />
      {subtitle && <Txt p="subtitle" as="p" className="lead hdr-sub" fit />}
    </header>
  )
}

export function Bullets({ p = 'bullets', className, marker }: { p?: string; className?: string; marker?: 'check' | 'x' | 'dot' }) {
  const { content, editable } = useSlide()
  const list = (getPath(content, p) as string[] | undefined) ?? []
  if (!list.length && !editable) return null
  return (
    <ul className={cx('bul', marker && `bul-${marker}`, className)}>
      {list.map((_, i) => (
        <li key={i}>
          {marker === 'check' || marker === 'x' ? (
            <span className="bul-ic">
              <Icon name={marker === 'check' ? 'check' : 'x'} size={14} stroke={3} />
            </span>
          ) : (
            <span className="bul-dot" />
          )}
          <Txt p={`${p}.${i}`} as="span" fit />
        </li>
      ))}
    </ul>
  )
}

export function initials(name = ''): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function Avatar({ name, url, size = 64, tone = 0 }: { name?: string; url?: string; size?: number; tone?: number }) {
  return (
    <span className={cx('avatar', `avatar-${tone % 3}`)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url ? <img src={assetUrl(url)} alt={name ?? ''} data-pptx="image" /> : <span data-pptx="text">{initials(name)}</span>}
    </span>
  )
}

export function items<T>(arr: T[] | undefined, max: number): T[] {
  return (arr ?? []).slice(0, max)
}
