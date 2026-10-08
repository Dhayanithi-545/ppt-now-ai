import type { ComponentType } from 'react'
import { LAYOUT_SPEC, type LayoutId } from '../design/types'
import { BeforeAfter, ChartFull, ChartInsight, Comparison, IconGrid, ImageText, KpiCards, ProcessSteps, ProsCons, StatsBigNumbers, TableLayout, Timeline, TitleBullets, Agenda } from './layouts/content'
import { BigStatement, Closing, CoverEditorial, CoverHero, CoverSplit, FullBleedImage, Quote, SectionDivider } from './layouts/hero'
import { MarketSize, PricingTiers, ProblemSolution, Swot, TeamGrid, Testimonials } from './layouts/business'

export const LAYOUTS: Record<LayoutId, ComponentType> = {
  'cover-hero': CoverHero,
  'cover-split': CoverSplit,
  'cover-editorial': CoverEditorial,
  agenda: Agenda,
  'section-divider': SectionDivider,
  'big-statement': BigStatement,
  'title-bullets': TitleBullets,
  'stats-big-numbers': StatsBigNumbers,
  'kpi-cards': KpiCards,
  'icon-grid-3': () => <IconGrid n={3} />,
  'icon-grid-4': () => <IconGrid n={4} />,
  'icon-grid-6': () => <IconGrid n={6} />,
  'image-text-left': () => <ImageText side="left" />,
  'image-text-right': () => <ImageText side="right" />,
  'full-bleed-image': FullBleedImage,
  timeline: Timeline,
  'process-steps': ProcessSteps,
  comparison: Comparison,
  'before-after': BeforeAfter,
  'pros-cons': ProsCons,
  'chart-insight': ChartInsight,
  'chart-full': ChartFull,
  table: TableLayout,
  quote: Quote,
  testimonials: Testimonials,
  'team-grid': TeamGrid,
  'pricing-tiers': PricingTiers,
  'problem-solution': ProblemSolution,
  'market-size': MarketSize,
  swot: Swot,
  closing: Closing,
}

/** Layouts drawn on the theme's hero fill (when the theme has one). */
export const INVERSE_LAYOUTS = new Set<LayoutId>(['cover-hero', 'section-divider', 'closing'])

export function isHero(layout: LayoutId): boolean {
  return LAYOUT_SPEC[layout]?.kind === 'hero'
}
