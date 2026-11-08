'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FeatureRow } from '@/analysis/types'
import { CONFIG } from '@/analysis/config'
import {
  basicStats, dowWeatherTable, monthMarks, tempChanges, weatherGroups,
} from '@/analysis/dashboardStats'

/**
 * 과거 기록 패널 모음: 날씨별 매출, 요일×비 표, 기온 급변 목록, 기본 통계, 달력.
 * 입력: 특징 행 목록 (유효 영업일 기준으로 계산합니다)
 * 출력: 각 패널. 비교할 날이 적은 칸은 "비교할 날 부족"으로 둡니다.
 * 주의점: 과거 차이를 보여 줄 뿐 원인이 아닙니다. 화면 설명에 그대로 적습니다.
 *         금액은 원 단위 정수로 보입니다.
 */

const won = (x: number) => `₩${Math.round(x).toLocaleString('ko-KR')}`
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const Card = ({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
    <h3 className="text-h2 text-slate-700">{title}</h3>
    {desc && <p className="text-xs text-slate-400">{desc}</p>}
    {children}
  </div>
)

export function WeatherSalesCard({ rows }: { rows: FeatureRow[] }) {
  const groups = weatherGroups(rows)
  return (
    <Card title="날씨별 평균 매출" desc="비 없음·약한 비·강한 비는 강수량 기준입니다. 맑음과 흐림은 구분하지 않았습니다.">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={groups} margin={{ top: 10, right: 8, bottom: 4, left: 4 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tickFormatter={(v: number) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 11 }} width={44} />
          <Tooltip formatter={(v) => won(Number(v))} />
          <Bar dataKey="avgSales" radius={[5, 5, 0, 0]}>
            {groups.map((g) => <Cell key={g.key} fill={g.count < CONFIG.minBandDays ? '#cbd5e1' : '#3b82f6'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ul className="text-xs text-slate-500 grid grid-cols-2 gap-1">
        {groups.map((g) => (
          <li key={g.key}>{g.label}: {g.count < CONFIG.minBandDays ? '비교할 날 부족' : `${won(g.avgSales)} (${g.count}일)`}</li>
        ))}
      </ul>
    </Card>
  )
}

export function DowWeatherCard({ rows }: { rows: FeatureRow[] }) {
  const table = dowWeatherTable(rows)
  const bands = [
    { key: 'none' as const, label: '비 없음' },
    { key: 'light' as const, label: '약한 비' },
    { key: 'heavy' as const, label: '강한 비' },
  ]
  return (
    <Card title="요일 × 날씨" desc={`같은 요일과 같은 비 구간의 평균입니다. 비교할 날이 ${CONFIG.minBandDays}일보다 적으면 평균을 보여 주지 않습니다.`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="py-1 text-left">요일</th>
              {bands.map((b) => <th key={b.key} className="py-1">{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {DOW.map((name, dow) => (
              <tr key={name} className="border-t border-slate-100">
                <td className={`py-1 text-left font-semibold ${dow === 0 || dow === 6 ? 'text-orange-600' : 'text-slate-700'}`}>{name}</td>
                {bands.map((b) => {
                  const c = table[dow]![b.key]
                  return (
                    <td key={b.key} className="py-1">
                      {c.avgSales === null ? <span className="text-xs text-slate-400">비교할 날 부족 ({c.count})</span> : <span>{won(c.avgSales)} <span className="text-xs text-slate-400">({c.count})</span></span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function TempChangeCard({ rows }: { rows: FeatureRow[] }) {
  const list = tempChanges(rows).slice(-CONFIG.similarMaxList).reverse()
  return (
    <Card title="기온이 급변한 날" desc={`전날보다 기온이 ${CONFIG.tempJumpC}℃ 이상 바뀐 날과 그날 매출이 전날보다 얼마나 바뀌었는지입니다.`}>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">해당하는 날이 없습니다.</p>
      ) : (
        <ul className="text-sm divide-y divide-slate-100">
          {list.map((c) => (
            <li key={c.date} className="flex justify-between py-1">
              <span>{c.date} <span className="text-xs text-slate-500">({c.tempDelta >= 0 ? '+' : ''}{c.tempDelta.toFixed(1)}℃)</span></span>
              <span className="text-slate-600">
                {won(c.sales)}
                {c.changePct !== null && <span className={c.changePct < 0 ? ' text-red-600' : ' text-blue-600'}> {c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(1)}%</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function BasicStatsCard({ rows }: { rows: FeatureRow[] }) {
  const s = basicStats(rows)
  if (s.count === 0) return <Card title="기본 통계"><p className="text-sm text-slate-500">영업한 날이 없습니다.</p></Card>
  return (
    <Card title="기본 통계" desc={`영업한 ${s.count}일 기준입니다.`}>
      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="평균 매출" value={won(s.avgSales ?? 0)} />
        <Stat label="변동 폭 (최고 − 최저)" value={won(s.range ?? 0)} />
        <Stat label="가장 잘 팔린 날" value={s.max ? `${s.max.date} · ${won(s.max.sales)}` : '-'} />
        <Stat label="가장 적게 팔린 날" value={s.min ? `${s.min.date} · ${won(s.min.sales)}` : '-'} />
        <Stat label="평일 평균" value={won(s.weekdayAvg ?? 0)} />
        <Stat label="주말 평균" value={won(s.weekendAvg ?? 0)} />
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800 text-sm break-words">{value}</div>
    </div>
  )
}

export function MonthCalendarCard({ rows, cutoff }: { rows: FeatureRow[]; cutoff: string }) {
  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.date.slice(0, 7)))).sort(), [rows])
  const [picked, setPicked] = useState<string | null>(null)
  const month = picked ?? cutoff.slice(0, 7)
  const marks = monthMarks(rows, month)
  const avg = basicStats(rows.filter((r) => r.date.startsWith(month))).avgSales
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay()

  const tone = (sales: number | null) => {
    if (sales === null || avg === null) return 'bg-slate-50 text-slate-300'
    if (sales >= avg * 1.1) return 'bg-emerald-100 text-emerald-800'
    if (sales <= avg * 0.9) return 'bg-orange-100 text-orange-800'
    return 'bg-slate-100 text-slate-700'
  }
  const rainMark = (band: FeatureRow['rainBand']) => (band === 'heavy' ? '강한 비' : band === 'light' ? '비' : '')

  return (
    <Card title="달력 보기" desc="초록은 그 달 평균보다 10% 이상 높은 날, 주황은 10% 이상 낮은 날입니다. 휴는 휴무 후보(매출 0), 빨강 날짜는 공휴일입니다.">
      <div className="flex items-center justify-between">
        <select className="text-sm border border-slate-300 rounded-lg px-2 py-1" value={month} onChange={(e) => setPicked(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-500">그 달 평균 {avg === null ? '-' : won(avg)}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DOW.map((d) => <div key={d} className="text-slate-400 py-1">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} />)}
        {marks.map((m) => (
          <div key={m.date} className={`rounded-md p-1 min-h-[52px] ${tone(m.sales)}`}>
            <div className={`font-semibold ${m.isHoliday ? 'text-red-600' : ''}`}>{Number(m.date.slice(8))}</div>
            <div className="text-[10px]">{m.sales === null ? '' : `${Math.round(m.sales / 10000)}만`}</div>
            <div className="text-[10px] text-slate-600">
              {m.isClosed ? '휴' : rainMark(m.rainBand)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
