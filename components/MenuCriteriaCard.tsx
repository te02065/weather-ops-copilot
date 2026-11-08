'use client'

import { useMemo, useState } from 'react'
import type { DailyWeather, FeatureRow } from '@/analysis/types'
import type { MenuDaily } from '@/analysis/posReport'
import { menuCriteria, type Sensitivity } from '@/analysis/menuCriteria'
import { forecastBands } from '@/analysis/threeCriteria'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const CHIP: Record<Sensitivity, string> = {
  높음: 'bg-red-50 text-red-700',
  보통: 'bg-amber-50 text-amber-800',
  낮음: 'bg-slate-100 text-slate-600',
  미확정: 'bg-white text-slate-400 border border-slate-200',
}
const won = (x: number | null) => (x === null ? '비교할 날 부족' : x < 10000 ? '1만 원 미만' : `약 ${Math.round(x / 10000)}만 원`)

/**
 * 메뉴별 ①②③과 민감도 (웹 상세). 날짜를 골라서 봅니다.
 * 입력: 메뉴별 일 매출, 특징 행, 기준일, 날짜 목록, 날짜별 예보
 * 출력: 메뉴 표 (보통 요일 매출, 같은 날씨 매출, 평균 대비, 민감도, 비교한 날)
 * 주의점: 매출 금액은 만 원 단위입니다. 비교할 날이 부족하면 "비교할 날 부족"으로 둡니다.
 */
export default function MenuCriteriaCard({ menu, features, cutoff, dates, forecasts }: {
  menu: MenuDaily[]; features: FeatureRow[]; cutoff: string; dates: string[]; forecasts: Record<string, DailyWeather | null>
}) {
  const firstWithForecast = dates.find((d) => forecasts[d]) ?? dates[0] ?? ''
  const [picked, setPicked] = useState<string>('')
  const date = picked || firstWithForecast
  const rows = useMemo(() => (date ? menuCriteria(menu, features, cutoff, date, forecastBands(forecasts[date])) : []), [menu, features, cutoff, date, forecasts])
  if (!date) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h2 text-slate-700">메뉴별 날씨 영향</h3>
        <select className="text-sm border border-slate-300 rounded-lg px-2 py-1" value={date} onChange={(e) => setPicked(e.target.value)}>
          {dates.map((d) => <option key={d} value={d}>{d} ({DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-500">
        요일 평균 매출은 같은 요일이었던 날들의 평균이에요. 날씨별 평균 매출은 예보와 같은 날씨였던 날들의 평균이에요.
        등급 높음·보통·낮음은 날씨에 따라 매출이 많이 달라지는 정도예요. 미확정은 비교할 날이 아직 부족하다는 뜻이에요.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 text-left">
              <th className="py-1">메뉴</th><th className="py-1">요일 평균</th><th className="py-1">날씨별 평균</th><th className="py-1">평균 대비</th><th className="py-1">등급</th><th className="py-1">비교한 날</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="py-1 font-semibold text-slate-800">{r.name}</td>
                <td className="py-1">{won(r.sameWeekday)}</td>
                <td className="py-1">{won(r.sameWeather)}</td>
                <td className="py-1">{r.diffPct === null ? '-' : `${r.diffPct >= 0 ? '+' : ''}${Math.round(r.diffPct)}%`}</td>
                <td className="py-1"><span className={`text-xs rounded px-2 py-0.5 ${CHIP[r.sensitivity]}`}>{r.sensitivity}</span></td>
                <td className="py-1 text-xs text-slate-500">{r.days}일</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
