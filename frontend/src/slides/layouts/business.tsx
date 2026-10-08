import { useSlide } from '../context'
import { Avatar, Bullets, Eyebrow, Header, Icon, IconChip, Txt, cx, items } from '../primitives'

export function Testimonials() {
  const { content } = useSlide()
  const list = items(content.items, 3)
  return (
    <div className="L tm">
      <Header subtitle={false} />
      <div className={cx('tm-grid', `n${list.length}`)}>
        {list.map((it, i) => (
          <figure className="card tm-card" key={i}>
            <span className="tm-mark" aria-hidden>“</span>
            <Txt p={`items.${i}.text`} as="blockquote" className="tm-text" fit />
            <figcaption className="tm-by">
              <Avatar name={it.title} url={it.image?.url} size={48} tone={i} />
              <div>
                <Txt p={`items.${i}.title`} as="div" className="tm-name" />
                <Txt p={`items.${i}.label`} as="div" className="small muted" />
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function TeamGrid() {
  const { content } = useSlide()
  const list = items(content.items, 6)
  const compact = list.length > 4
  return (
    <div className={cx('L', 'team', compact && 'team-compact')}>
      <Header />
      <div className={cx('team-grid', `n${list.length}`)}>
        {list.map((it, i) => (
          <div className="team-card" key={i}>
            <Avatar name={it.title} url={it.image?.url} size={compact ? 76 : 128} tone={i} />
            <div className="team-info">
              <Txt p={`items.${i}.title`} as="div" className="h4" />
              <Txt p={`items.${i}.label`} as="div" className="team-role" />
              <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PricingTiers() {
  const { content } = useSlide()
  const list = items(content.items, 3)
  const hiIdx = Math.max(0, list.findIndex((t) => t.highlight))
  const hi = list.some((t) => t.highlight) ? hiIdx : Math.floor(list.length / 2)
  return (
    <div className="L price">
      <Header subtitle={false} />
      <div className={cx('price-row', `n${list.length}`)}>
        {list.map((_, i) => (
          <div className={cx('card', 'price-card', i === hi && 'price-hi')} key={i}>
            {i === hi && <span className="price-badge">Most popular</span>}
            <Txt p={`items.${i}.title`} as="div" className="price-name" />
            <div className="price-amt">
              <Txt p={`items.${i}.value`} as="span" className="price-val" />
              <Txt p={`items.${i}.label`} as="span" className="price-per" />
            </div>
            <Txt p={`items.${i}.text`} as="div" className="small price-desc" fit />
            <div className="price-sep" />
            <Bullets p={`items.${i}.bullets`} marker="check" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProblemSolution() {
  const { content } = useSlide()
  const [prob, sol] = items(content.items, 2)
  return (
    <div className="L prs">
      <div className="prs-left">
        <Eyebrow />
        <Txt p="title" as="h2" className="h2" fit />
        <div className="prs-block">
          <div className="prs-label prs-label-bad">
            <Icon name={prob?.icon || 'triangle-alert'} size={18} stroke={2.2} />
            <Txt p="items.0.title" as="span" />
          </div>
          <Txt p="items.0.text" as="p" className="body-lg muted" fit />
          <Bullets p="items.0.bullets" marker="x" />
        </div>
      </div>
      <div className="prs-right" data-surface="fill">
        <div className="prs-label prs-label-good">
          <Icon name={sol?.icon || 'lightbulb'} size={18} stroke={2.2} />
          <Txt p="items.1.title" as="span" />
        </div>
        <Txt p="items.1.text" as="p" className="prs-sol" fit />
        <Bullets p="items.1.bullets" marker="check" />
      </div>
    </div>
  )
}

export function MarketSize() {
  const { content } = useSlide()
  const list = items(content.items, 3)
  const sizes = [440, 304, 176]
  return (
    <div className="L mkt">
      <Header subtitle={false} />
      <div className="mkt-row">
        <div className="mkt-circles">
          {list.map((_, i) => (
            <div className={`mkt-c mkt-c${i}`} key={i} style={{ width: sizes[i], height: sizes[i] }}>
              <Txt p={`items.${i}.label`} as="span" className="mkt-cl" />
            </div>
          ))}
        </div>
        <div className="mkt-list">
          {list.map((_, i) => (
            <div className="mkt-item" key={i}>
              <span className={`mkt-sw mkt-sw${i}`} />
              <div className="mkt-txt">
                <div className="mkt-line">
                  <Txt p={`items.${i}.value`} as="span" className="mkt-val" />
                  <Txt p={`items.${i}.label`} as="span" className="mkt-tag" />
                </div>
                <Txt p={`items.${i}.title`} as="div" className="h4" />
                <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const SWOT_ICONS = ['shield-check', 'triangle-alert', 'rocket', 'flame']

export function Swot() {
  const { content } = useSlide()
  const list = items(content.items, 4)
  return (
    <div className="L swot">
      <Header subtitle={false} />
      <div className="swot-grid">
        {list.map((it, i) => (
          <div className={cx('card', 'swot-q', `swot-${i}`)} key={i}>
            <span className="swot-letter" aria-hidden>{(it.title || 'SWOT')[0]}</span>
            <div className="swot-head">
              <IconChip name={SWOT_ICONS[i]} size={40} tone={(['primary', 'secondary', 'accent', 'primary'] as const)[i]} />
              <Txt p={`items.${i}.title`} as="div" className="h4" />
            </div>
            <Bullets p={`items.${i}.bullets`} />
          </div>
        ))}
      </div>
    </div>
  )
}
