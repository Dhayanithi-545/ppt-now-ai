import { useSlide } from '../context'
import { Chart } from '../Chart'
import { SlideImage } from '../SlideImage'
import { Bullets, Eyebrow, Header, Icon, IconChip, Txt, cx, items } from '../primitives'

export function Agenda() {
  const { content } = useSlide()
  const list = items(content.items, 6)
  return (
    <div className="L agenda">
      <div className="ag-head">
        <Eyebrow />
        <Txt p="title" as="h2" className="h1" fit />
        <Txt p="subtitle" as="p" className="lead" fit />
      </div>
      <ol className={cx('ag-list', `n${list.length}`, list.length > 4 && 'ag-dense')}>
        {list.map((_, i) => (
          <li key={i}>
            <span className="ag-num">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <Txt p={`items.${i}.title`} as="div" className="h4" fit />
              <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TitleBullets() {
  const { content, variant } = useSlide()
  const many = (content.bullets?.length ?? 0) > 4
  const cards = variant === 'cards'
  return (
    <div className="L tb">
      <Header />
      <Bullets className={cx('tb-list', many && 'tb-cols')} marker={cards ? 'number' : undefined} itemClassName={cards ? 'card' : undefined} />
    </div>
  )
}

export function StatsBigNumbers() {
  const { content } = useSlide()
  const list = items(content.items, 4)
  return (
    <div className="L stats">
      <Header />
      <div className={cx('st-row', `n${list.length}`)}>
        {list.map((_, i) => (
          <div className="st-cell" key={i}>
            <Txt p={`items.${i}.value`} as="div" className="big-num" />
            <Txt p={`items.${i}.label`} as="div" className="h4" />
            <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
          </div>
        ))}
      </div>
    </div>
  )
}

export function KpiCards() {
  const { content } = useSlide()
  const list = items(content.items, 4)
  return (
    <div className="L kpi">
      <Header />
      <div className={cx('kpi-grid', `n${list.length}`)}>
        {list.map((it, i) => {
          const neg = /^[-−–]/.test(it.delta ?? '')
          return (
            <div className="card kpi-card" key={i}>
              <div className="kpi-top">
                <IconChip name={it.icon} size={48} tone={(['primary', 'secondary', 'accent'] as const)[i % 3]} />
                {it.delta && (
                  <span className={cx('delta', neg ? 'delta-bad' : 'delta-good')}>
                    <Icon name={neg ? 'trending-down' : 'trending-up'} size={15} stroke={2.4} />
                    <Txt p={`items.${i}.delta`} as="span" />
                  </span>
                )}
              </div>
              <Txt p={`items.${i}.value`} as="div" className="kpi-val" />
              <Txt p={`items.${i}.label`} as="div" className="h4" />
              <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function IconGrid({ n }: { n: 3 | 4 | 6 }) {
  const { content } = useSlide()
  const list = items(content.items, n)
  return (
    <div className={cx('L', 'ig', `ig-${n}`)}>
      <Header subtitle={n !== 6} />
      <div className="ig-grid">
        {list.map((it, i) => (
          <div className="card ig-card" key={i}>
            <IconChip name={it.icon} size={n === 3 ? 64 : n === 4 ? 56 : 52} tone={(['primary', 'secondary', 'accent'] as const)[i % 3]} />
            <div className="ig-body">
              <Txt p={`items.${i}.title`} as="div" className={n === 3 ? 'h3' : 'h4'} fit />
              <Txt p={`items.${i}.text`} as="div" className={n === 3 ? 'body muted' : 'small muted'} fit />
            </div>
            {n === 3 && <span className="ig-idx">{String(i + 1).padStart(2, '0')}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ImageText({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={cx('L', 'it', `it-${side}`)}>
      <SlideImage className="it-img" />
      <div className="it-text">
        <Eyebrow />
        <Txt p="title" as="h2" className="h2" fit />
        <Txt p="body" as="p" className="body-lg muted" fit />
        <Bullets marker="check" className="it-bul" />
      </div>
    </div>
  )
}

export function Timeline() {
  const { content } = useSlide()
  const list = items(content.items, 6)
  return (
    <div className="L tl">
      <Header subtitle={false} />
      <div className={cx('tl-track', `n${list.length}`)}>
        <div className="tl-line" />
        {list.map((_, i) => (
          <div className="tl-item" key={i}>
            <Txt p={`items.${i}.value`} as="div" className="tl-date" />
            <span className="tl-dot" />
            <Txt p={`items.${i}.title`} as="div" className="h4" fit />
            <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProcessSteps() {
  const { content } = useSlide()
  const list = items(content.items, 5)
  return (
    <div className="L ps">
      <Header />
      <div className={cx('ps-row', `n${list.length}`)}>
        {list.map((it, i) => (
          <div className="ps-step" key={i}>
            <div className="card ps-card">
              <div className="ps-top">
                <span className="ps-num">{String(i + 1).padStart(2, '0')}</span>
                <Icon name={it.icon} size={26} />
              </div>
              <Txt p={`items.${i}.title`} as="div" className="h4" fit />
              <Txt p={`items.${i}.text`} as="div" className="small muted" fit />
            </div>
            {i < list.length - 1 && (
              <span className="ps-arrow">
                <Icon name="arrow-right" size={18} stroke={2.4} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Comparison() {
  const { content } = useSlide()
  const list = items(content.items, 2)
  return (
    <div className="L cmp">
      <Header subtitle={false} />
      <div className="cmp-row">
        {list.map((it, i) => (
          <div className={cx('card', 'cmp-col', i === 1 && 'cmp-hi')} key={i}>
            <div className="cmp-head">
              <IconChip name={it.icon} size={52} tone={i === 1 ? 'solid' : 'primary'} />
              <Txt p={`items.${i}.title`} as="div" className="h3" fit />
            </div>
            <Txt p={`items.${i}.text`} as="div" className="body muted" fit />
            <Bullets p={`items.${i}.bullets`} marker="check" />
          </div>
        ))}
        <span className="vs">vs</span>
      </div>
    </div>
  )
}

export function BeforeAfter() {
  const { content } = useSlide()
  const list = items(content.items, 2)
  return (
    <div className="L ba">
      <Header subtitle={false} />
      <div className="ba-row">
        {list.map((_, i) => (
          <div className={cx('ba-col', i === 0 ? 'ba-before' : 'ba-after')} key={i}>
            <span className="ba-tag">{i === 0 ? 'Before' : 'After'}</span>
            <Txt p={`items.${i}.title`} as="div" className="h3" fit />
            <Bullets p={`items.${i}.bullets`} marker={i === 0 ? 'x' : 'check'} />
          </div>
        ))}
        <span className="ba-arrow">
          <Icon name="arrow-right" size={26} stroke={2.4} />
        </span>
      </div>
    </div>
  )
}

export function ProsCons() {
  const { content } = useSlide()
  const list = items(content.items, 2)
  return (
    <div className="L pc">
      <Header subtitle={false} />
      <div className="pc-row">
        {list.map((_, i) => (
          <div className={cx('card', 'pc-col', i === 0 ? 'pc-pro' : 'pc-con')} key={i}>
            <div className="pc-head">
              <span className="pc-ic">
                <Icon name={i === 0 ? 'thumbs-up' : 'triangle-alert'} size={22} stroke={2} />
              </span>
              <Txt p={`items.${i}.title`} as="div" className="h3" fit />
            </div>
            <Bullets p={`items.${i}.bullets`} marker={i === 0 ? 'check' : 'x'} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartInsight() {
  const { content } = useSlide()
  const list = items(content.items, 3)
  return (
    <div className="L ci">
      <Header subtitle={false} />
      <div className="ci-row">
        <div className="card ci-chart">
          <Chart spec={content.chart} />
        </div>
        <div className="ci-side">
          {list.map((_, i) => (
            <div className="ci-ins" key={i}>
              <Txt p={`items.${i}.value`} as="div" className="ci-val" />
              <Txt p={`items.${i}.text`} as="div" className="body muted" fit />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChartFull() {
  const { content } = useSlide()
  return (
    <div className="L cf">
      <Header />
      <div className="card cf-chart">
        <Chart spec={content.chart} />
      </div>
    </div>
  )
}

export function TableLayout() {
  const { content } = useSlide()
  const t = content.table
  const cols = Math.min(t?.headers.length ?? 0, 5)
  const rows = (t?.rows ?? []).slice(0, 6)
  return (
    <div className="L tbl">
      <Header />
      <div className={cx('tbl-wrap', rows.length > 4 && 'tbl-dense')} data-pptx="table">
        <table>
          <thead>
            <tr>
              {t?.headers.slice(0, cols).map((_, i) => (
                <th key={i}>
                  <Txt p={`table.headers.${i}`} as="span" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci}>{r[ci] != null ? <Txt p={`table.rows.${ri}.${ci}`} as="span" /> : null}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
