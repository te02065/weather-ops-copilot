'use client'

import type { DayCriteria } from '@/analysis/threeCriteria'
import type { DayOutlook } from '@/analysis/outlook'
import { sameWeatherName } from '@/analysis/weeklyBriefing'
import { weatherView } from '@/analysis/forecastView'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** 만 원 단위 표시. 1만 원 미만은 "1만 원 미만". */
export function manWon(x: number): string {
  if (x < 10000) return '1만 원 미만'
  return `약 ${Math.round(x / 10000)}만 원`
}

/**
 * 다음 7일 한눈에 (명세 v0.1 §7): 날짜마다 ①같은 요일 ②작년 같은 날 ③같은 날씨 세 줄.
 * 입력: 날짜별 세 기준 (null이면 받는 중)
 * 출력: 날짜 카드 목록. 숫자는 계산 결과만 쓰고, 표본이 부족하면 안내 문장을 씁니다.
 * 주의점: "정확하다", "발주", "가격" 같은 문장은 쓰지 않습니다. 파일럿 기간에는 참고용입니다.
 */
export default function NextSevenDaysCard({ days, loadingCount, outlook }: { days: Array<DayCriteria | null>; loadingCount: number; outlook: Array<DayOutlook | null> }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-h2 text-slate-700">다음 7일 한눈에</h3>
        <p className="text-sm text-slate-600 mt-1">날마다 세 가지로 비교합니다. 참고용이며 정확도는 아직 검증 중이에요.</p>
      </div>
      {loadingCount > 0 && <p className="text-sm text-slate-500">예보를 받는 중입니다 ({loadingCount}일 남음)</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {days.map((d, i) => (d === null ? <div key={i} className="rounded-lg border border-slate-200 p-4 text-sm text-slate-400">받는 중…</div> : <DayCard key={d.date} d={d} o={outlook[i] ?? null} />))}
      </div>
    </div>
  )
}

function DayCard({ d, o }: { d: DayCriteria; o: DayOutlook | null }) {
  const noForecast = d.weatherLabel === '예보 없음'
  const v = weatherView(d.forecast)
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${noForecast ? 'border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800">{d.date.slice(5)} ({DOW[d.dow]})</span>
        <span className="text-2xl" title={v.rain} aria-label={v.rain}>{v.icon}</span>
      </div>
      <p className="text-sm text-slate-800">{noForecast ? '예보 없음 (잠시 후 다시 확인)' : [v.rain, v.sky].filter(Boolean).join(' · ')}</p>
      {v.temp && <p className="text-xs text-slate-600">{v.temp}</p>}
      {o && <OutlookLine o={o} />}
      {d.festival === 'day' && <p className="text-xs rounded bg-amber-50 text-amber-800 px-2 py-1">명절 영향 가능: 명절 당일이라 평소와 다를 수 있어요</p>}
      {d.festival === 'excluded' && <p className="text-xs text-slate-500">명절 전후 3일은 과거 비교에서 뺐어요</p>}
      <ul className="text-sm text-slate-700 space-y-1">
        <li>① {DOW[d.dow]}요일 평균 매출: {d.sameWeekday.avg === null ? '아직 비교할 날이 부족해요' : `${manWon(d.sameWeekday.avg)} (${d.sameWeekday.n}일 기록)`}</li>
        <li>② 작년 {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8, 10))}일 매출: {d.lastYear.sales === null ? '작년 기록이 없어요' : `${manWon(d.lastYear.sales)} (1일 기록)`}</li>
        <li>③ {sameWeatherName(d)}: {sameWeatherText(d)}</li>
      </ul>
    </div>
  )
}

function sameWeatherText(d: DayCriteria): string {
  if (d.weatherLabel === '예보 없음') return '예보가 없어 계산하지 않았어요'
  if (d.sameWeather.avg === null) return '아직 비교할 날이 부족해요'
  if (d.sameWeather.range) return `${manWon(d.sameWeather.range[0])} ~ ${manWon(d.sameWeather.range[1]).replace('약 ', '')} (${d.sameWeather.n}일 기록)`
  return `${manWon(d.sameWeather.avg)} (${d.sameWeather.n}일 기록)`
}

const ARROW = { more: { text: '평소보다 많이 팔릴 가능성', mark: '▲', tone: 'text-blue-700 bg-blue-50' }, less: { text: '평소보다 적게 팔릴 가능성', mark: '▼', tone: 'text-red-700 bg-red-50' }, similar: { text: '평소와 비슷할 가능성', mark: '≈', tone: 'text-slate-700 bg-slate-100' }, unknown: { text: '추이를 보여 줄 수 없어요', mark: '–', tone: 'text-slate-500 bg-slate-50' } } as const

/** 날씨를 넣었을 때 방향과 대략의 범위 (정확한 금액 대신 범위). */
function OutlookLine({ o }: { o: DayOutlook }) {
  const a = ARROW[o.direction]
  const range = o.rangeLow !== null && o.rangeHigh !== null ? `대략 ${manWon(o.rangeLow)} ~ ${manWon(o.rangeHigh).replace('약 ', '')}` : '범위 없음'
  return (
    <div className="space-y-1">
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${a.tone}`}>{a.mark} {a.text}</span>
      <p className="text-xs text-slate-500">{range}</p>
      <p className="text-xs text-slate-500">{o.reason}</p>
    </div>
  )
}
