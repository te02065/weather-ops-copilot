'use client'

import { CONFIG } from '@/analysis/config'

/**
 * 날씨 설명 카드: 화면에 나오는 기온·비·체감온도 용어의 기준을 적습니다.
 * 입력: 없음 (기준 숫자는 analysis/config.ts에서 읽음)
 * 출력: 항목별 한 줄 설명
 * 주의점: 기준 숫자를 여기에 따로 적지 않습니다. 바꾸면 config만 고치면 됩니다.
 */
export default function WeatherExplainCard() {
  const items = [
    { name: '하루 평균 기온', text: '그날 하루의 평균 기온이에요. 같은 달 평균보다 높으면 따뜻한 날, 낮으면 추운 날이에요.' },
    { name: '비가 온 양', text: `하루 동안 내린 비의 양이에요. ${CONFIG.rainNoneMaxMm}mm보다 적으면 비 없는 날, ${CONFIG.rainNoneMaxMm}~${CONFIG.rainHeavyMinMm}mm는 약한 비, ${CONFIG.rainHeavyMinMm}mm 이상은 강한 비예요.` },
    { name: '비 올 가능성', text: '예보에서 알려 주는 비 올 확률이에요. 확률이 낮으면 비 없는 날 쪽으로, 높으면 비 오는 날 쪽으로 두 경우를 함께 계산해요.' },
    { name: '많이 달라진 날', text: `전날보다 기온이 ${CONFIG.tempJumpC}℃ 이상 달라진 날이에요.` },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">날씨 용어 설명</h3>
      <dl className="space-y-2 text-sm">
        {items.map((it) => (
          <div key={it.name}>
            <dt className="font-semibold text-slate-800">{it.name}</dt>
            <dd className="text-slate-600">{it.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
