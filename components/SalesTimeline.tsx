'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { DailySalesPoint } from '@/analysis/summary'

const fmtSales = (v: number) => `₩${Math.round(v / 10000)}k`

/** 일별 매출 추이. 원본 매출은 이 화면에서만 계산해서 보여 줍니다 (서버로 보내지 않음). */
export default function SalesTimeline({ series, storeName }: { series: DailySalesPoint[]; storeName: string }) {
  const data = series.map((p) => ({ date: p.date, sales: p.sales }))
  const tickInterval = Math.floor(data.length / 10)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-h2 text-slate-700 mb-1">{storeName} 일별 매출</h3>
      <p className="text-xs text-slate-400 mb-4">업로드한 기록 그대로의 일별 매출입니다. 날씨 효과가 아니라 흐름만 보여 줍니다.</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
            interval={tickInterval}
            tickFormatter={(d: string) => `${parseInt(d.slice(5, 7))}/'${d.slice(2, 4)}`}
          />
          <YAxis width={48} tickFormatter={fmtSales} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const v = payload[0]?.value
              return (
                <div className="bg-white border border-slate-200 shadow-md rounded-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-700">{String(label)}</p>
                  <p className="text-slate-500">{fmtSales(typeof v === 'number' ? v : 0)}</p>
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="url(#salesGrad)" strokeWidth={1} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
