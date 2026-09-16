'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { DowRow } from '@/lib/analytics'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { DOW_LABELS } from '@/lib/i18n/dictionary'

const fmtSales = (v: number) => `₩${Math.round(v / 10000)}k`

// Chart's actual plot-area inset = Y_AXIS_WIDTH + margin.left (left) / margin.right (right).
// The index table below reuses these exact values so its 7 columns land under the 7 bars.
const Y_AXIS_WIDTH = 44
const CHART_MARGIN = { top: 10, right: 8, bottom: 4, left: 4 }

export default function DowBarChart({ dowEffect }: { dowEffect: DowRow[] }) {
  const { lang, t } = useLanguage()
  const dowLabels = DOW_LABELS[lang]
  const validRows = dowEffect.filter((d) => d.count > 0)
  const overall   = validRows.reduce((s, d) => s + d.avgSales, 0) / (validRows.length || 1)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-h2 text-slate-700 mb-1">{t.dowChartTitle}</h3>
      <p className="text-xs text-slate-400 mb-4">{t.dowChartDesc}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dowEffect} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="dow" tickFormatter={(v: number) => dowLabels[v] ?? ''} tick={{ fontSize: 13 }} />
          <YAxis width={Y_AXIS_WIDTH} tickFormatter={fmtSales} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const v = payload[0]?.value
              return (
                <div className="bg-white border border-slate-200 shadow-md rounded-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-700">{dowLabels[label as number] ?? label}</p>
                  <p className="text-slate-500 mt-0.5">{fmtSales(typeof v === 'number' ? v : 0)}</p>
                </div>
              )
            }}
          />
          <ReferenceLine y={overall} stroke="#94a3b8" strokeDasharray="5 3" />
          <Bar dataKey="avgSales" radius={[5, 5, 0, 0]}>
            {dowEffect.map((d) => (
              <Cell
                key={d.dow}
                fill={d.dow === 0 || d.dow === 6 ? '#f97316' : '#3b82f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Index table — padded to match the bar chart's plot-area inset exactly */}
      <div
        className="mt-4 grid grid-cols-7 gap-1 text-center"
        style={{ paddingLeft: Y_AXIS_WIDTH + CHART_MARGIN.left, paddingRight: CHART_MARGIN.right }}
      >
        {dowEffect.map((d) => (
          <div key={d.dow} className="text-xs">
            <div className="font-medium text-slate-700">{dowLabels[d.dow]}</div>
            <div className={`font-bold ${d.index >= 1.05 ? 'text-orange-500' : d.index <= 0.95 ? 'text-slate-400' : 'text-slate-600'}`}>
              {d.index >= 1 ? '+' : ''}{((d.index - 1) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
