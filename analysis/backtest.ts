/**
 * 이 파일이 하는 일: 과거 데이터로 예측을 되돌려 보는 백테스트를 실행합니다 (방법론 §7).
 * 입력: 특징 행 목록 (전체 기간, 기준일 = 마지막 날)
 * 출력: 날짜별 예측 기록 (실제, M1 예측, 기준선 A·B, holdout 여부)
 * 주의점:
 *   - 롤링 원점: 유효 영업일 56번째부터 하루씩 옮기며 예측합니다. 모델은 7 유효 영업일마다 다시 맞춥니다.
 *   - 목표일 t의 예측에는 t 이전 데이터만 씁니다 (재적합 때 기준일 = t의 바로 앞 유효 영업일).
 *   - holdout: 마지막 28 유효 영업일. 모델을 holdout 직전까지 데이터로 한 번 맞추고, 한 번만 예측합니다.
 *   - 실제 날씨를 목표일 입력으로 씁니다 (관측 기반 입력). 예보 오차는 반영하지 않습니다 [예보 기반은 8단계 이후].
 *   - 기준 숫자(56, 7, 28)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'
import { isValidDay } from './features'
import { baselineA, baselineB } from './baseline'
import { trainM1, predictM1, type M1Model } from './regression'
import type { FeatureRow } from './types'

export interface BacktestPoint {
  date: string
  actual: number
  m1: number | null
  baseA: number | null
  baseB: number | null
  holdout: boolean
}

export function runBacktest(rows: FeatureRow[]): BacktestPoint[] {
  const valid = rows.filter(isValidDay).sort((a, b) => (a.date < b.date ? -1 : 1))
  const holdoutStart = Math.max(CONFIG.minTrainDays, valid.length - CONFIG.holdoutDays)
  const out: BacktestPoint[] = []
  const modelFor = holdoutModelCache(rows, valid, holdoutStart)
  let model: M1Model | null = null
  for (let i = CONFIG.minTrainDays; i < valid.length; i++) {
    const target = valid[i]!
    const isHoldout = i >= holdoutStart
    if (isHoldout) {
      model = modelFor(i)
    } else if ((i - CONFIG.minTrainDays) % CONFIG.refitEveryDays === 0 || model === null) {
      model = trainM1(rows, valid[i - 1]!.date) // 재적합: 목표일 바로 앞 유효 영업일까지만 사용
    }
    out.push({
      date: target.date,
      actual: target.y as number,
      m1: model ? predictM1(model, target) : null,
      baseA: baselineA(rows, target.date).value,
      baseB: baselineB(rows, target.date).value,
      holdout: isHoldout,
    })
  }
  return out
}

/** holdout 구간의 모델은 holdout 시작 직전 데이터로 한 번만 맞춥니다. */
function holdoutModelCache(rows: FeatureRow[], valid: FeatureRow[], holdoutStart: number): (i: number) => M1Model {
  let cached: M1Model | null = null
  return () => {
    if (cached === null) cached = trainM1(rows, valid[holdoutStart - 1]!.date)
    return cached
  }
}
