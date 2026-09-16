'use client'

import {
  ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Label,
} from 'recharts'
import type { ScatterPoint, Correlations } from '@/lib/analytics'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const fmtSales = (v: number) => `₩${Math.round(v / 10000)}k`
const fmtPct   = (v: number) => `${(v * 100).toFixed(1)}%`

interface TooltipPayload { x: number; y: number }

function CustomTooltip({
  active, payload, xLabel, xUnit, yLabel, yFmt,
}: {
  active?: boolean
  payload?: Array<{ payload: TooltipPayload }>
  xLabel: string
  xUnit: string
  yLabel: string
  yFmt: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const { x, y } = payload[0]!.payload
  return (
    <div className="bg-white border border-slate-200 shadow rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-500">{xLabel}: <span className="font-semibold text-slate-800">{x}{xUnit}</span></p>
      <p className="text-slate-500">{yLabel}: <span className="font-semibold text-slate-800">{yFmt(y)}</span></p>
    </div>
  )
}

interface ChartConfig {
  data: Array<{ x: number; y: number }>
  title: string
  xLabel: string
  xUnit: string
  yLabel: string
  yFmt: (v: number) => string
  yTickFmt: (v: number) => string
  color: string
}

function Chart({ data, title, xLabel, xUnit, yLabel, yFmt, yTickFmt, color }: ChartConfig) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 36, left: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="x" type="number" name={xLabel} tick={{ fontSize: 11 }}>
            <Label value={`${xLabel} (${xUnit})`} position="insideBottom" offset={-20} fontSize={11} fill="#94a3b8" />
          </XAxis>
          <YAxis dataKey="y" type="number" name={yLabel} tickFormatter={yTickFmt} tick={{ fontSize: 11 }}>
            <Label value={yLabel} angle={-90} position="insideLeft" offset={16} fontSize={11} fill="#94a3b8" />
          </YAxis>
          <Tooltip
            content={
              <CustomTooltip xLabel={xLabel} xUnit={xUnit} yLabel={yLabel} yFmt={yFmt} />
            }
          />
          <Scatter data={data} fill={color} opacity={0.45} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function WeatherScatterCharts({
  scatter,
  correlations,
}: {
  scatter: ScatterPoint[]
  correlations: Correlations
}) {
  const { t } = useLanguage()
  const precipData = scatter.map((p) => ({ x: p.precip,  y: p.totalSales }))
  const tempData   = scatter.map((p) => ({ x: p.tempMax, y: p.iceRatio }))

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{t.scatterSectionTitle}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          data={precipData}
          title={`${t.precipVsSalesTitle}  (r = ${correlations.salesVsPrecip})`}
          xLabel={t.precipitation} xUnit="mm"
          yLabel={t.dailySales}
          yFmt={fmtSales} yTickFmt={fmtSales}
          color="#ef4444"
        />
        <Chart
          data={tempData}
          title={`${t.tempVsIceRatioTitle}  (r = ${correlations.iceRatioVsTemp})`}
          xLabel={t.maxTemp} xUnit="°C"
          yLabel={t.iceRatio}
          yFmt={fmtPct} yTickFmt={fmtPct}
          color="#3b82f6"
        />
      </div>
    </section>
  )
}
