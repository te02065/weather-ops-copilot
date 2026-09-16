'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ScatterPoint } from '@/lib/analytics'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const fmtSales = (v: number) => `₩${Math.round(v / 10000)}k`

export default function SalesTimeline({
  scatter,
  storeName,
}: {
  scatter: ScatterPoint[]
  storeName: string
}) {
  const { t } = useLanguage()
  const data = [...scatter]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date:       p.date,
      totalSales: p.totalSales,
      iceSales:   p.iceSales,
      hotSales:   p.hotSales,
    }))

  const tickInterval = Math.floor(data.length / 10)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-h2 text-slate-700 mb-1">{storeName} {t.timelineTitleSuffix}</h3>
      <p className="text-xs text-slate-400 mb-4">{t.timelineDesc}</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="iceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
            interval={tickInterval}
            tickFormatter={(d: string) => {
              const m = parseInt(d.slice(5, 7))
              const y = d.slice(2, 4)
              return `${m}/'${y}`
            }}
          />
          <YAxis width={48} tickFormatter={fmtSales} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white border border-slate-200 shadow-md rounded-lg px-3 py-2 text-xs space-y-0.5">
                  <p className="font-semibold text-slate-700">{String(label)}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="text-slate-500">
                      {p.dataKey === 'iceSales' ? t.iced : t.hot}:{' '}
                      {fmtSales(typeof p.value === 'number' ? p.value : 0)}
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Area
            type="monotone" dataKey="iceSales" stackId="1"
            stroke="#3b82f6" fill="url(#iceGrad)" strokeWidth={1} dot={false}
          />
          <Area
            type="monotone" dataKey="hotSales" stackId="1"
            stroke="#f97316" fill="url(#hotGrad)" strokeWidth={1} dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
