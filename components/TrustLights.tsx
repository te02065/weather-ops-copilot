'use client'

import { CONFIG } from '@/analysis/config'

type Light = 'green' | 'yellow' | 'red' | 'gray'

const DOT: Record<Light, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-red-500', gray: 'bg-slate-300' }

/**
 * 데이터 신뢰도 신호등. 기준은 모두 analysis/config.ts에서 옵니다.
 * 입력: 학습에 쓴 날 수, 날씨 결측 비율, 검증 판정(없으면 null)
 * 출력: 세 항목의 색과 한 줄 설명
 * 주의점: 신호등이 초록이라도 통계적 보장은 아닙니다. 참고 수준입니다.
 */
export default function TrustLights({ trainDays, weatherMissingRatio, verdict }: {
  trainDays: number
  weatherMissingRatio: number
  verdict: 'adopt' | 'hold' | 'reject' | null
}) {
  const sample: Light = trainDays >= CONFIG.recommendedTrainDays ? 'green' : trainDays >= CONFIG.minTrainDays ? 'yellow' : 'red'
  const weather: Light = weatherMissingRatio <= CONFIG.maxWeatherMissingRatio ? 'green' : 'red'
  const judge: Light = verdict === 'adopt' ? 'green' : verdict === 'hold' ? 'yellow' : verdict === 'reject' ? 'red' : 'gray'
  const items: Array<{ label: string; light: Light; text: string }> = [
    { label: '기록 기간', light: sample, text: `영업한 날 ${trainDays}일 (권장 ${CONFIG.recommendedTrainDays}일 이상이면 가장 좋아요)` },
    { label: '날씨 기록', light: weather, text: `날씨 기록이 빠진 날 ${(weatherMissingRatio * 100).toFixed(1)}%` },
    { label: '검증 결과', light: judge, text: '검증 중 (과거 기록으로 맞춰 보는 중이에요)' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">데이터 신뢰도</h3>
      <ul className="space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-3">
            <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${DOT[it.light]}`} aria-hidden />
            <span><span className="font-semibold text-slate-800">{it.label}</span> <span className="text-slate-600">{it.text}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
