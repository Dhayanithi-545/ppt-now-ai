import { useSlide } from '../context'
import { SlideImage } from '../SlideImage'
import { Avatar, Eyebrow, Icon, Txt, items } from '../primitives'

function CoverMeta() {
  const { content, editable } = useSlide()
  if (!content.meta && !editable) return null
  return (
    <div className="cover-meta">
      <span className="meta-bar" />
      <Txt p="meta" as="span" placeholder="Presenter · Date" />
    </div>
  )
}

export function CoverHero() {
  return (
    <div className="L cover-hero">
      <Eyebrow />
      <Txt p="title" as="h1" className="display" fit />
      <Txt p="subtitle" as="p" className="lead cover-sub" fit />
      <CoverMeta />
    </div>
  )
}

export function CoverSplit() {
  return (
    <div className="L cover-split">
      <div className="cs-text">
        <Eyebrow />
        <Txt p="title" as="h1" className="display" fit />
        <Txt p="subtitle" as="p" className="lead" fit />
        <CoverMeta />
      </div>
      <SlideImage className="cs-img" />
    </div>
  )
}

export function CoverEditorial() {
  return (
    <div className="L cover-ed">
      <div className="ed-top">
        <Eyebrow />
        <Txt p="meta" as="span" className="ed-meta" placeholder="Issue · Date" />
      </div>
      <div className="ed-bottom">
        <Txt p="title" as="h1" className="ed-title" fit />
        <div className="ed-side">
          <span className="ed-mark" />
          <Txt p="subtitle" as="p" className="lead" fit />
        </div>
      </div>
    </div>
  )
}

export function SectionDivider() {
  const { content, index } = useSlide()
  const num = content.meta || String(index + 1).padStart(2, '0')
  return (
    <div className="L divider">
      <div className="dv-num" data-pptx="text">{num}</div>
      <div className="dv-text">
        <Eyebrow />
        <Txt p="title" as="h1" className="h1" fit />
        <Txt p="subtitle" as="p" className="lead" fit />
      </div>
    </div>
  )
}

export function BigStatement() {
  const { content } = useSlide()
  return (
    <div className="L statement">
      <Eyebrow />
      <Txt p="title" as="h1" className="st-text" highlight={content.highlight} fit />
      <div className="st-foot">
        <span className="meta-bar" />
        <Txt p="subtitle" as="p" className="lead" fit />
      </div>
    </div>
  )
}

export function Quote() {
  const { content } = useSlide()
  return (
    <div className="L quote">
      <div className="q-mark" aria-hidden>“</div>
      <Txt p="quote" as="blockquote" className="q-text" fit />
      <div className="q-by">
        <Avatar name={content.author} size={60} />
        <div>
          <Txt p="author" as="div" className="q-name" />
          <Txt p="role" as="div" className="q-role" />
        </div>
      </div>
    </div>
  )
}

export function Closing() {
  const { content } = useSlide()
  return (
    <div className="L closing">
      <Eyebrow />
      <Txt p="title" as="h1" className="display" fit />
      <Txt p="subtitle" as="p" className="lead" fit />
      <div className="cl-contacts">
        {items(content.items, 3).map((it, i) => (
          <div className="cl-contact" key={i}>
            <Icon name={it.icon || 'mail'} size={20} />
            <Txt p={`items.${i}.text`} as="span" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FullBleedImage() {
  return (
    <div className="L fullbleed">
      <SlideImage className="fb-img" treatment="square" />
      <div className="fb-shade" data-layer="bg" />
      <div className="fb-text">
        <Eyebrow />
        <Txt p="title" as="h1" className="h1" fit />
        <Txt p="subtitle" as="p" className="lead" fit />
      </div>
    </div>
  )
}
