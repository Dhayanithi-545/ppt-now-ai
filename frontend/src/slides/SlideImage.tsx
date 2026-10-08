import type { CSSProperties } from 'react'
import type { ImageTreatment } from '../design/types'
import { ArtImage } from './ArtImage'
import { getPath, useSlide } from './context'
import type { ImageRef } from '../design/types'
import { cx } from './primitives'
import { assetUrl } from '../config'

interface Props {
  /** Path of the ImageRef in SlideContent. */
  p?: string
  className?: string
  style?: CSSProperties
  /** Override the theme's image treatment (e.g. full-bleed is always square). */
  treatment?: ImageTreatment
  icon?: string
}

/** Photo with the theme's treatment, or a theme-colored illustration when there is no photo. */
export function SlideImage({ p = 'image', className, style, treatment, icon }: Props) {
  const { content, theme, slide, editable, onImageClick } = useSlide()
  const img = getPath(content, p) as ImageRef | undefined
  const tr = treatment ?? theme.imageTreatment
  return (
    <div
      className={cx('img', `img-${tr}`, editable && 'img-editable', className)}
      style={style}
      data-pptx-group="image"
      onClick={editable && onImageClick ? () => onImageClick(p) : undefined}
    >
      {img?.url ? (
        <>
          <img src={assetUrl(img.url)} alt={img.alt ?? img.query ?? ''} data-pptx="image" draggable={false} />
          {tr === 'duotone' && <div className="duo" />}
        </>
      ) : (
        <ArtImage theme={theme} seed={slide.id + p} icon={icon} query={img?.query ?? content.title} />
      )}
      {img?.credit && <span className="img-credit">{img.credit}</span>}
    </div>
  )
}
