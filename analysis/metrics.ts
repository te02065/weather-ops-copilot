/**
 * 이 파일이 하는 일: 예측 정확도 지표를 계산합니다 (방법론 §8).
 * 입력: 실제값, 예측값(M1), 기준선 값(Baseline A)의 짝 목록
 * 출력: MAE, WAPE, Bias, 방향 정확도, 표본 수 (표본이 없으면 값은 null)
 * 주의점: 실제 매출 합이 0이면 WAPE를 계산하지 않고 오류(zeroSum)로 표시합니다 (방법론 §8 규칙).
 *         방향 정확도의 2% 기준은 analysis/config.ts의 directionThresholdPct입니다.
 *         모든 지표는 표본 수 n과 함께 보고합니다.
 */

import { CONFIG } from './config'

export interface PredictionPair {
  actual: number
  pred: number | null
  base: number | null // 기준선 A
}

export interface Metrics {
  n: number
  mae: number | null
  wape: number | null
  bias: number | null
  directionAcc: number | null
  zeroSum: boolean // 실제 매출 합이 0이라 WAPE를 계산하지 않음
}

/** 예측이 있는 날만 지표에 씁니다. */
export function computeMetrics(pairs: PredictionPair[]): Metrics {
  const used = pairs.filter((p): p is PredictionPair & { pred: number } => p.pred !== null)
  const n = used.length
  if (n === 0) return { n: 0, mae: null, wape: null, bias: null, directionAcc: null, zeroSum: false }
  const errors = used.map((p) => p.actual - p.pred)
  const sumAbs = errors.reduce((s, e) => s + Math.abs(e), 0)
  const sumActual = used.reduce((s, p) => s + p.actual, 0)
  const meanActual = sumActual / n
  const mae = sumAbs / n
  const zeroSum = sumActual === 0
  return {
    n,
    mae,
    wape: zeroSum ? null : sumAbs / sumActual,
    bias: meanActual === 0 ? null : errors.reduce((s, e) => s + e, 0) / n / meanActual,
    directionAcc: directionAccuracy(used),
    zeroSum,
  }
}

/** 방향 정확도: 기준선 대비 올랐는지 줄었는지를 맞춘 비율. 실제 변화가 ±2% 이내면 "변화 없음"입니다. */
function directionAccuracy(pairs: Array<PredictionPair & { pred: number }>): number | null {
  const comparable = pairs.filter((p) => p.base !== null && p.base !== 0)
  if (comparable.length === 0) return null
  const hits = comparable.filter((p) => {
    const base = p.base as number
    const actualChange = (p.actual - base) / base * 100
    const dAct = Math.abs(actualChange) < CONFIG.directionThresholdPct ? 0 : Math.sign(actualChange)
    const dPred = Math.sign(p.pred - base)
    return dAct === dPred
  })
  return hits.length / comparable.length
}
