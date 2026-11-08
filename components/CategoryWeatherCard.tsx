'use client'

import type { BandTable } from '@/analysis/menuWeather'
import { categoryLabel } from './posLabels'

const BANDS = [
  { key: 'none' as const, label: '비 없음' },
  { key: 'light' as const, label: '약한 비' },
  { key: 'heavy' as const, label: '강한 비' },
]
const won = (x: number) => `${Math.round(x / 10000).toLocaleString('ko-KR')}만 원`

/**
 * 날씨별 카테고리 매출 표 (설명용). 행은 POS 카테고리 또는 메뉴, 열은 강수 구간입니다.
 * 입력: 이름별 강수 구간 표
 * 출력: 하루 평균 매출(만 원) 과 표본 일 수. 표본이 적으면 "표본 부족".
 * 주의점: 과거 같은 날씨였던 날들의 평균 차이입니다. 원인을 단정하지 않습니다.
 */
export default function CategoryWeatherCard({ title, desc, table }: { title: string; desc: string; table: Record<string, BandTable> }) {
  const rows = Object.entries(table).sort((a, b) => sumAvg(b[1]) - sumAvg(a[1]))
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">{title}</h3>
      <p className="text-xs text-slate-500">{desc}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="py-1 text-left">이름</th>
              {BANDS.map((b) => <th key={b.key} className="py-1">{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, t]) => (
              <tr key={name} className="border-t border-slate-100">
                <td className="py-1 text-left font-semibold text-slate-700">{categoryLabel(name)}</td>
                {BANDS.map((b) => (
                  <td key={b.key} className="py-1">
                    {t[b.key].avgPerDay === null
                      ? <span className="text-xs text-slate-400">비교할 날 부족 ({t[b.key].days}일)</span>
                      : <span>{won(t[b.key].avgPerDay!)} <span className="text-xs text-slate-400">({t[b.key].days}일)</span></span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function sumAvg(t: BandTable): number {
  return BANDS.reduce((s, b) => s + (t[b.key].avgPerDay ?? 0), 0)
}
