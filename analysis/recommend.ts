/**
 * 이 파일이 하는 일: 예측 결과에서 규칙 기반의 참고 제안 문구를 만듭니다 (방법론 §11, Level 1).
 * 입력: Prediction (forecast.ts의 결과)
 * 출력: 제안 목록. 각 제안에는 근거 수준(evidence)과 표본 수(sampleSize)가 붙습니다.
 * 주의점: 원가·폐기·인건비 데이터가 없으므로 비용 기반 최적화는 하지 않습니다 (Level 2 금지).
 *         모든 문구는 "검토할 수 있습니다", "관찰되었습니다"처럼 단정하지 않는 표현을 씁니다 (방법론 §5.2).
 *         기준 숫자(0.95, 표본 8일)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'
import type { Prediction } from './forecast'

export interface Recommendation {
  text: string
  evidence: 'descriptive' | 'model_supported' // 설명(과거 패턴) / 모델 상태 ok에서만 나오는 제안
  sampleSize: number
}

export function recommend(p: Prediction): Recommendation[] {
  const out: Recommendation[] = []
  if (p.status === 'ok' && p.expectedSales !== null && p.baselineSales !== null
      && p.expectedSales < p.baselineSales * CONFIG.recommendBelowBaselineRatio) {
    out.push({ text: '준비량을 과거 비 오는 날과 비교해 볼 수 있어요.', evidence: 'model_supported', sampleSize: p.sampleSize })
  }
  const heavy = p.factors.find((f) => f.name === 'rain_heavy')
  if (heavy && heavy.effectPct < 0) {
    out.push({ text: '과거 강한 비가 내린 날에는 평소보다 매출이 낮게 관찰되었습니다.', evidence: 'descriptive', sampleSize: heavy.sampleSize })
  }
  return out
}
