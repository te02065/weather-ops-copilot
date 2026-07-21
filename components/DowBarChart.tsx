'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { DowRow } from '@/lib/analytics'

const fmtSales = (v: number) => `₩${Math.round(v / 10000)}k`

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function DowBarChart({ dowEffect }: { dowEffect: DowRow[] }) {
  const validRows = dowEffect.filter((d) => d.count > 0)
  const overall   = validRows.reduce((s, d) => s + d.avgSales, 0) / (validRows.length || 1)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Avg Sales by Day of Week</h3>
      <p className="text-xs text-slate-400 mb-4">Dashed: overall avg  |  Orange: weekend</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dowEffect} margin={{ top: 10, right: 10, bottom: 4, left: 52 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="dow" tickFormatter={(v: number) => DOW_EN[v] ?? ''} tick={{ fontSize: 13 }} />
          <YAxis tickFormatter={fmtSales} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const v = payload[0]?.value
              return (
                <div className="bg-white border border-slate-200 shadow-md rounded-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-700">{DOW_EN[label as number] ?? label}</p>
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

      {/* Index table */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {dowEffect.map((d) => (
          <div key={d.dow} className="text-xs">
            <div className="font-medium text-slate-700">{DOW_EN[d.dow]}</div>
            <div className={`font-bold ${d.index >= 1.05 ? 'text-orange-500' : d.index <= 0.95 ? 'text-slate-400' : 'text-slate-600'}`}>
              {d.index >= 1 ? '+' : ''}{((d.index - 1) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
