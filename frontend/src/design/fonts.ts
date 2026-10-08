// Curated fonts, bundled locally (no CDN) so preview, PDF and PPTX rasterization are deterministic.
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/manrope'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/outfit'
import '@fontsource-variable/work-sans'
import '@fontsource-variable/nunito'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/syne'
import '@fontsource/archivo-black'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/playfair-display'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource/dm-serif-display'
import '@fontsource/instrument-serif'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/lora'
import '@fontsource-variable/jetbrains-mono'

import { FONTS, type FontName } from './types'

/** Variable fontsource packages register the family as "<Name> Variable". */
const STATIC = new Set<string>(['Archivo Black', 'DM Serif Display', 'Instrument Serif'])

export function fontStack(name: FontName): string {
  const meta = FONTS[name]
  const family = STATIC.has(name) ? `'${name}'` : `'${name} Variable', '${name}'`
  const generic = meta.kind === 'serif' ? 'serif' : meta.kind === 'mono' ? 'monospace' : 'sans-serif'
  return `${family}, '${meta.fallback}', ${generic}`
}
