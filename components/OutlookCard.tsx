'use client'

import type { DayOutlook } from '@/analysis/outlook'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

const LABEL = {
  more: { text: '평소보다 많이 팔릴 가능성', mark: '▲', tone: 'text-blue-700 bg-blue-50' },
  less: { text: '평소보다 적게 팔릴 가능성', mark: '▼', tone: 'text-red-700 bg-red-50' },
  similar: { text: '평소와 비슷할 가능성', mark: '≈', tone: 'text-slate-700 bg-slate-100' },
  unknown: { text: '추이를 보여 줄 수 없음', mark: '–', tone: 'text-slate-500 bg-slate-50' },
} as const

const manWon = (x: number) => `${Math.round(x / 10000)}만 원`

/**
 * 7일 추이 안내. 정확한 금액 대신 방향과 대략의 범위를 보여 줍니다.
 * 입력: 날짜별 추이 (null이면 아직 받는 중)
 * 출력: 날짜, 요일, 방향, 대략 범위, 근거 한 줄
 * 주의점: 예보가 없는 날은 숫자를 쓰지 않습니다. 맨 아래 문장은 항상 보입니다.
 */
export default function OutlookCard({ days, loadingCount }: { days: Array<DayOutlook | null>; loadingCount: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-h2 text-slate-700">앞으로 7일 추이 안내</h3>
        <p className="text-sm text-slate-600 mt-1">정확한 금액이 아니라, 날씨 때문에 평소보다 많이 또는 적게 팔릴 가능성을 보여 줍니다.</p>
      </div>
      {loadingCount > 0 && <p className="text-sm text-slate-500">예보를 받는 중입니다 ({loadingCount}일 남음). 처음에는 날마다 시간이 걸릴 수 있어요.</p>}
      <ul className="divide-y divide-slate-100">
        {days.map((d, i) => {
          if (d === null) return <li key={i} className="py-3 text-sm text-slate-400">받는 중…</li>
          const l = LABEL[d.direction]
          const range = d.rangeLow !== null && d.rangeHigh !== null ? `약 ${manWon(d.rangeLow)} ~ ${manWon(d.rangeHigh)}` : '-'
          return (
            <li key={d.date} className="py-3 grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-2 text-sm">
              <div className="font-semibold text-slate-800">{d.date.slice(5)} ({DOW[d.dow]})</div>
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${l.tone}`}>{l.mark} {l.text}</span>
                <div className="text-xs text-slate-500 mt-1">대략 범위: {range}</div>
              </div>
              <div className="text-xs text-slate-500">{d.reason}</div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-400">
        예보는 틀릴 수 있고, 계산도 오차가 있습니다. 추이를 참고하고, 실제 매출이 나온 뒤 맞는지 확인하세요.
      </p>
    </div>
  )
}
