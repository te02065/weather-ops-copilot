'use client'

import type { Prediction } from '@/analysis/forecast'
import type { Recommendation } from '@/analysis/recommend'
import { directionOf, roundToManWon } from '@/analysis/outlook'
import { CONFIG } from '@/analysis/config'
import { weekdayName } from './plain'

const manWon = (x: number) => `${Math.round(x / 10000)}만 원`

/**
 * 목표일 추이 (하루). 정확한 금액은 쓰지 않고, 방향과 대략의 범위만 보여 줍니다.
 * 입력: 예측 결과, 참고 제안 목록
 * 출력: 방향, 대략 범위, 근거 한 줄. 예보가 없으면 "예보 없음"과 이유만.
 * 주의점: 정확한 금액을 화면에 쓰면 실제 매출과 조금만 달라도 신뢰를 잃습니다. 그래서 숫자는 만 원 단위입니다.
 */
export default function PredictionCard({ prediction, recommendations }: { prediction: Prediction; recommendations: Recommendation[] }) {
  const p = prediction
  const day = weekdayName(p.targetDate)
  const hasRange = p.expectedSales !== null
  const band = CONFIG.outlookBandPct / 100
  const low = p.expectedSales !== null ? roundToManWon(p.expectedSales * (1 - band)) : null
  const high = p.expectedSales !== null ? roundToManWon(p.expectedSales * (1 + band)) : null
  const dir = p.changeRatePct !== null ? directionOf(p.changeRatePct) : 'unknown'
  const headline = dir === 'more' ? '평소보다 많이 팔릴 가능성' : dir === 'less' ? '평소보다 적게 팔릴 가능성' : dir === 'similar' ? '평소와 비슷할 가능성' : '추이를 보여 줄 수 없어요'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-h2 text-slate-700">{p.targetDate} ({day}) 추이</h3>
      <p className="text-xl font-semibold text-slate-900">{headline}</p>
      {hasRange && low !== null && high !== null && (
        <p className="text-base text-slate-700">대략 범위: 약 {manWon(low)} ~ {manWon(high)}</p>
      )}
      <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
        {hasRange ? <li>날씨 예보를 넣어서 본 추이예요</li> : <li>날씨 예보를 받지 못해서 날씨를 넣을 수 없어요</li>}
        {p.baselineSales !== null && <li>평소 {day} 매출은 같은 요일 최근 4번의 평균이에요</li>}
      </ul>
      {p.status !== 'ok' && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{p.statusText}</p>}
      {recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-400">참고 제안</div>
          {recommendations.map((r) => (
            <p key={r.text} className="text-sm text-slate-700">
              • {r.text} <span className="text-xs text-slate-400">({r.evidence === 'model_supported' ? '날씨 근거' : '과거 패턴'}, {r.sampleSize}일 기록)</span>
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">예보와 계산에는 오차가 있습니다. 참고용입니다.</p>
    </div>
  )
}
