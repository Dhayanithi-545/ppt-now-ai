// Runs with Vitest globals (describe/it/expect) from frontend/vite.config.ts: cd frontend && npm test
import { fontFor, parseColor, primaryFont, pxToIn, pxToPt } from '../../frontend/src/export/pptx'
import { contrast, mix, readableOn } from '../../frontend/src/design/color'
import { ensureContrast } from '../../frontend/src/design/themeVars'
import { missingData, remapContent } from '../../frontend/src/design/remap'
import { THEMES } from '../../frontend/src/design/themes'

describe('pptx helpers', () => {
  it('converts px to inches and points on the 1280×720 canvas', () => {
    expect(pxToIn(1280)).toBeCloseTo(13.333, 3)
    expect(pxToIn(720)).toBe(7.5)
    expect(pxToPt(16)).toBe(12)
  })
  it('parses computed colours', () => {
    expect(parseColor('rgb(255, 0, 16)')).toEqual({ hex: 'FF0010', alpha: 1 })
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ hex: '000000', alpha: 0.5 })
    expect(parseColor('rgba(0, 0, 0, 0)')).toBeNull()
    expect(parseColor('#1a2b3c')).toEqual({ hex: '1A2B3C', alpha: 1 })
  })
  it('maps fontsource families to PowerPoint font names', () => {
    expect(primaryFont("'Inter Variable', 'Inter', 'Arial', sans-serif")).toBe('Inter')
    expect(fontFor("'Fraunces Variable', serif", false)).toBe('Fraunces')
    expect(fontFor("'Fraunces Variable', serif", true)).toBe('Georgia')
  })
})

describe('colour + contrast', () => {
  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(readableOn('#ffffff')).toBe('#0b0b0f')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('auto-fixes low contrast', () => {
    expect(contrast(ensureContrast('#cccccc', '#ffffff', 4.5), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
  it('every built-in theme has readable body text', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10)
    for (const t of THEMES) expect(contrast(t.colors.text, t.colors.bg)).toBeGreaterThanOrEqual(7)
  })
})

describe('layout remapping', () => {
  it('turns bullets into items and back', () => {
    const c = { title: 'T', bullets: ['Fast: ships in a day', 'Cheap', 'Private by default'] }
    const items = remapContent(c, 'icon-grid-3').items!
    expect(items[0]).toMatchObject({ title: 'Fast', text: 'ships in a day', icon: 'sparkles' })
    const back = remapContent({ title: 'T', items }, 'title-bullets')
    expect(back.bullets?.[0]).toBe('Fast: ships in a day')
  })
  it('flags layouts that need data the slide does not have', () => {
    expect(missingData('chart-full', { title: 'x' })).toBe('chart')
    expect(missingData('table', { title: 'x' })).toBe('table')
    expect(missingData('icon-grid-3', { title: 'x', bullets: ['a', 'b', 'c'] })).toBeNull()
  })
})
