import { useLayoutEffect, useRef, useState } from 'react'
import { SLIDE_H, SLIDE_W, SlideView, type SlideViewProps } from './SlideView'

/** Renders a 1280×720 slide scaled to the width of its container. */
export function SlideCanvas({ className, ...props }: SlideViewProps & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / SLIDE_W)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ position: 'relative', width: '100%', aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, overflow: 'hidden' }}>
      {scale > 0 && (
        <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
          <SlideView {...props} />
        </div>
      )}
    </div>
  )
}
