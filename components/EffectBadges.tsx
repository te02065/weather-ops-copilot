'use client'

import type { M1Model } from '@/analysis/regression'
import { effectsPct } from '@/analysis/regression'
import { CONFIG } from '@/analysis/config'
import { plainPercent } from './plain'

interface Counts { light: number; heavy: number; training: number }

/**
 * 날씨별 차이 (초등학생 기준): "비 오는 날 매출은 평소보다 18% 적었어요" 꼴로 씁니다.
 * 입력: 모델 효과(%), 구간별 표본 수
 * 출력: 항목별 한 줄 결론, 표본 수, 자세히 보기(정확한 %)
 * 주의점: 표본이 기준(8일) 미만이거나 계산이 안 된 구간은 "기록이 적어 알 수 없어요"로 씁니다.
 *         과거 기록에서 본 차이이며, 원인을 단정하지 않습니다.
 */
export default function EffectBadges({ model, counts }: { model: M1Model; counts: Counts }) {
  const e = effectsPct(model)
  const items = [
    { label: '약한 비가 온 날', value: e.rainLight, n: counts.light, dropped: model.dropped.includes('rain_light') },
    { label: '강한 비가 온 날', value: e.rainHeavy, n: counts.heavy, dropped: model.dropped.includes('rain_heavy') },
    { label: '기온이 1℃ 높은 날', value: e.tempPerC, n: counts.training, dropped: model.dropped.includes('temp') },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-h2 text-slate-700">날씨별로 매출이 얼마나 달랐나요?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it) => {
          const lowSample = it.n < CONFIG.minBandDays
          const unknown = it.dropped || lowSample
          return (
            <div key={it.label} className="rounded-lg border border-slate-200 p-4 space-y-1">
              <div className="text-sm font-semibold text-slate-700">{it.label}</div>
              {unknown ? (
                <p className="text-sm text-slate-400">기록이 적어서 알 수 없어요</p>
              ) : (
                <p className={`text-base font-bold ${it.value < -0.5 ? 'text-red-600' : it.value > 0.5 ? 'text-blue-600' : 'text-slate-600'}`}>
                  {it.value < -0.5
                    ? `평소보다 ${plainPercent(it.value)} 적게 팔렸어요`
                    : it.value > 0.5
                      ? `평소보다 ${plainPercent(it.value)} 많이 팔렸어요`
                      : '평소와 거의 같았어요'}
                </p>
              )}
              <p className="text-xs text-slate-400">이런 날 {it.n}일의 기록으로 계산했어요</p>
              {!unknown && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">자세히 보기</summary>
                  <p className="mt-1">정확한 값: {it.value >= 0 ? '+' : ''}{it.value.toFixed(1)}% (평소 대비, 요일과 추세를 뺀 값)</p>
                </details>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">
        과거 기록에서 본 차이입니다. 날씨가 원인이라고 단정하지 않습니다. 0% 근처면 차이가 거의 없었다는 뜻입니다.
      </p>
    </div>
  )
}
