import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { alpha, mix } from '../design/color'
import { fontStack } from '../design/fonts'
import { seriesColors } from '../design/themeVars'
import type { ChartSpec, Theme } from '../design/types'
import { useSlide } from './context'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, SVGRenderer])

export function formatValue(v: number, unit?: string): string {
  const n = Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(+v.toFixed(2))
  if (!unit) return n
  if (/^[$€£¥₹]/.test(unit)) return unit + n
  return n + (unit.length <= 2 ? unit : ' ' + unit)
}

export function chartOption(spec: ChartSpec, theme: Theme, compact = false): echarts.EChartsCoreOption {
  const c = theme.colors
  const cols = seriesColors(theme)
  const font = fontStack(theme.fonts.body)
  const muted = c.muted
  const grid = mix(c.bg, c.text, theme.mode === 'dark' ? 0.14 : 0.1)
  const fs = compact ? 13 : 15
  const multi = spec.series.length > 1
  const base = {
    animation: false,
    color: cols,
    textStyle: { fontFamily: font, color: muted, fontSize: fs },
    legend: {
      show: multi || spec.type === 'pie' || spec.type === 'donut',
      top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, itemGap: 18,
      textStyle: { color: c.text, fontSize: fs, fontFamily: font },
    },
  }

  if (spec.type === 'pie' || spec.type === 'donut') {
    const data = spec.categories.map((name, i) => ({ name, value: spec.series[0]?.values[i] ?? 0 }))
    return {
      ...base,
      legend: { ...base.legend, orient: 'vertical', top: 'middle', right: 0 },
      series: [
        {
          type: 'pie',
          radius: spec.type === 'donut' ? ['54%', '82%'] : ['0%', '82%'],
          center: ['36%', '50%'],
          itemStyle: { borderColor: c.bg, borderWidth: 3, borderRadius: spec.type === 'donut' ? Math.min(theme.radius, 10) : 0 },
          label: {
            show: true, position: spec.type === 'donut' ? 'inside' : 'inside',
            formatter: (p: { percent: number }) => (p.percent >= 6 ? `${Math.round(p.percent)}%` : ''),
            color: '#fff', fontWeight: 700, fontSize: fs, fontFamily: font,
          },
          labelLine: { show: false },
          data,
        },
      ],
    }
  }

  const horizontal = spec.type === 'hbar'
  const isBar = spec.type === 'bar' || horizontal
  const r = Math.min(theme.radius / 2, 8)
  const catAxis = {
    type: 'category', data: spec.categories,
    axisLine: { lineStyle: { color: grid } }, axisTick: { show: false },
    axisLabel: { color: muted, fontSize: fs, fontFamily: font, margin: 12, hideOverlap: false, interval: 0 },
    boundaryGap: isBar,
  }
  const valAxis = {
    type: 'value',
    splitLine: { lineStyle: { color: grid, type: [4, 4] } },
    axisLabel: { color: muted, fontSize: fs - 1, fontFamily: font, formatter: (v: number) => formatValue(v, spec.unit) },
  }
  return {
    ...base,
    grid: { left: 4, right: 12, top: base.legend.show ? 44 : 16, bottom: 4, containLabel: true },
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? { ...catAxis, inverse: true } : valAxis,
    series: spec.series.map((s, i) => {
      const col = cols[i % cols.length]
      if (isBar) {
        return {
          type: 'bar', name: s.name, data: s.values, barMaxWidth: multi ? 34 : 64, barGap: '18%',
          itemStyle: {
            borderRadius: horizontal ? [0, r, r, 0] : [r, r, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, horizontal ? 1 : 0, horizontal ? 0 : 1, [
              { offset: 0, color: horizontal ? mix(col, c.bg, 0.15) : col },
              { offset: 1, color: horizontal ? col : mix(col, c.bg, 0.15) },
            ]),
          },
          label: {
            show: !multi && spec.categories.length <= 8, position: horizontal ? 'right' : 'top',
            color: c.text, fontWeight: 700, fontSize: fs, fontFamily: font, formatter: (p: { value: number }) => formatValue(p.value, spec.unit),
          },
        }
      }
      return {
        type: 'line', name: s.name, data: s.values, smooth: 0.35, symbol: 'circle', symbolSize: 9,
        lineStyle: { width: 3.5, color: col },
        itemStyle: { color: col, borderColor: c.bg, borderWidth: 2 },
        areaStyle:
          spec.type === 'area' || !multi
            ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(col, spec.type === 'area' ? 0.38 : 0.18) }, { offset: 1, color: alpha(col, 0) }]) }
            : undefined,
        label: { show: !multi && spec.categories.length <= 8, position: 'top', color: c.text, fontWeight: 700, fontSize: fs - 1, formatter: (p: { value: number }) => formatValue(p.value, spec.unit) },
      }
    }),
  }
}

export function Chart({ spec, compact, className }: { spec?: ChartSpec; compact?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useSlide()
  const key = JSON.stringify(spec)
  useEffect(() => {
    const el = ref.current
    if (!el || !spec?.series?.length) return
    const ch = echarts.init(el, null, { renderer: 'svg', width: el.clientWidth, height: el.clientHeight })
    ch.setOption(chartOption(spec, theme, compact))
    return () => ch.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, theme, compact])
  return <div ref={ref} className={className ?? 'chart'} data-pptx="chart" data-chart={key} />
}
