import { createContext, useContext } from 'react'
import type { Slide, SlideContent, Theme } from '../design/types'

export interface SlideCtxValue {
  slide: Slide
  content: SlideContent
  /** Resolved arrangement id (never empty). */
  variant: string
  theme: Theme
  index: number
  total: number
  deckTitle: string
  /** True for covers/dividers/closings drawn on the brand fill. */
  inverse: boolean
  editable: boolean
  /** Static render (PDF/export): no animation, no hover chrome. */
  print: boolean
  onEdit?: (path: string, value: string) => void
  onImageClick?: (path: string) => void
}

export const SlideCtx = createContext<SlideCtxValue | null>(null)

export function useSlide(): SlideCtxValue {
  const v = useContext(SlideCtx)
  if (!v) throw new Error('useSlide outside SlideView')
  return v
}

type Obj = Record<string, unknown>

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Obj)[k]), obj)
}

/** Immutable set: returns a new object with `path` set to `value`. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [k, ...rest] = path.split('.')
  const isIndex = /^\d+$/.test(k)
  const src = (obj ?? (isIndex ? [] : {})) as Obj | unknown[]
  const copy: Obj | unknown[] = Array.isArray(src) ? [...src] : { ...src }
  const cur = (copy as Obj)[k]
  ;(copy as Obj)[k] = rest.length ? setPath(cur, rest.join('.'), value) : value
  return copy as T
}
