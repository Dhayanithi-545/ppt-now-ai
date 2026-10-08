// Layout + design spec. The backend keeps an identical copy in backend/app/spec/ (a test enforces this).
import design from './design.json'
import layoutSpec from './layouts.json'

export type BackgroundStyle = 'mesh' | 'blobs' | 'grain' | 'geometric' | 'photo' | 'solid'
export type Motif =
  | 'none' | 'orbs' | 'grid' | 'dots' | 'rings' | 'brackets' | 'stripes' | 'frame' | 'waves' | 'confetti' | 'rules'
export type CardStyle = 'filled' | 'outline' | 'glass' | 'elevated' | 'brutal'
export type EyebrowStyle = 'pill' | 'line' | 'number' | 'plain' | 'mono'
export type ShadowStyle = 'none' | 'soft' | 'hard' | 'glow'
export type ImageTreatment = 'rounded' | 'square' | 'arch' | 'blob' | 'duotone' | 'slant'
export type HeroFill = 'none' | 'primary' | 'secondary' | 'accent' | 'gradient'
export type FontName = keyof typeof design.fonts

export interface ThemeColors {
  bg: string
  surface: string
  primary: string
  secondary: string
  accent: string
  text: string
  muted: string
  /** Text drawn on top of `primary` fills. */
  onPrimary: string
}

export interface Theme {
  id: string
  name: string
  description?: string
  mode: 'light' | 'dark'
  colors: ThemeColors
  /** Brand gradient: hero backgrounds, gradient text, accent bars. */
  gradient: { from: string; via?: string; to: string; angle: number }
  fonts: {
    heading: FontName
    body: FontName
    headingWeight: number
    headingUppercase?: boolean
    /** Letter spacing for headings, in em. */
    headingTracking: number
  }
  background: BackgroundStyle
  motif: Motif
  cardStyle: CardStyle
  eyebrowStyle: EyebrowStyle
  shadow: ShadowStyle
  imageTreatment: ImageTreatment
  /** Covers, dividers and closing slides flood with this color. */
  heroFill: HeroFill
  radius: number
  /** Big numbers and highlights use gradient text. */
  gradientText?: boolean
  /** Chart series colors; derived from the palette when omitted. */
  series?: string[]
  custom?: boolean
}

export interface ImageRef {
  /** Search keywords (what the LLM writes). */
  query?: string
  url?: string
  alt?: string
  credit?: string
}

export interface Item {
  icon?: string
  title?: string
  text?: string
  value?: string
  label?: string
  delta?: string
  bullets?: string[]
  highlight?: boolean
  image?: ImageRef
}

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'donut'

export interface ChartSpec {
  type: ChartType
  categories: string[]
  series: { name: string; values: number[] }[]
  unit?: string
}

export interface TableSpec {
  headers: string[]
  rows: string[][]
}

/** One flat content shape shared by every layout (makes layout switching lossless). */
export interface SlideContent {
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  highlight?: string
  meta?: string
  bullets?: string[]
  items?: Item[]
  chart?: ChartSpec
  table?: TableSpec
  quote?: string
  author?: string
  role?: string
  image?: ImageRef
}

export type LayoutId = keyof typeof layoutSpec.layouts

export interface Slide {
  id: string
  layout: LayoutId
  content: SlideContent
  notes?: string
  /** Still being generated (skeleton in the editor). */
  pending?: boolean
  /** Generation failed and a minimal slide was used. */
  error?: boolean
}

export interface OutlineItem {
  title: string
  layout: LayoutId
  intent: string
}

export interface Brief {
  prompt: string
  slide_count: number
  audience?: string | null
  purpose?: string | null
  tone?: string | null
  language: string
  research: boolean
}

export interface Deck {
  id: string
  title: string
  themeId: string
  /** Present when the deck uses a custom (prompt-generated) theme. */
  theme?: Theme
  slides: Slide[]
  outline?: OutlineItem[]
  brief?: Brief
  status?: 'outline' | 'generating' | 'ready'
  updated?: number
}

export const LAYOUT_SPEC = layoutSpec.layouts
export const LAYOUT_IDS = Object.keys(layoutSpec.layouts) as LayoutId[]
export const FONTS = design.fonts
export const ALLOWED_ICONS = design.icons
