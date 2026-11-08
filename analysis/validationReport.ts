/**
 * 이 파일이 하는 일: 백테스트 기록으로 검증 리포트를 만듭니다 (설계 §4 ValidationReport, 방법론 §13.2).
 * 입력: 백테스트 기록 목록 (runBacktest의 결과)
 * 출력: 구간별 지표(롤링 전체, holdout), ΔMAE(M1 − 기준선 A), 95% 구간, 판정(adopt/hold/reject)
 * 주의점: 판정은 holdout(최종 평가 구간) 기준입니다 (방법론 §7.2). 롤링 전체 결과는 참고용으로 같이 보고합니다.
 *         ΔMAE의 차이 d_i = |오차 M1| − |오차 기준선 A|, 날짜 순서대로 블록 부트스트랩합니다.
 *         M1 예측이나 기준선 A가 없는 날은 비교에서 뺍니다.
 */

import { blockBootstrapMean } from './bootstrap'
import { decideVerdict, type Verdict } from './verdict'
import { computeMetrics, type Metrics, type PredictionPair } from './metrics'
import type { BacktestPoint } from './backtest'

export interface ComparisonResult {
  pair: 'M1 vs Baseline A'
  n: number
  deltaMae: number | null   // 음수일수록 M1이 낮은 오차
  lower: number | null
  upper: number | null
  verdict: Verdict | null
}

export interface ValidationReport {
  rolling: Metrics          // holdout을 뺀 구간 (참고)
  holdout: Metrics          // 최종 평가 구간
  holdoutBaseA: Metrics
  comparison: ComparisonResult // holdout 기준 판정
  inputSource: 'observed_only'
}

export function buildValidationReport(points: BacktestPoint[]): ValidationReport {
  const rolling = points.filter((p) => !p.holdout)
  const holdout = points.filter((p) => p.holdout)
  return {
    rolling: computeMetrics(rolling.map(toPair)),
    holdout: computeMetrics(holdout.map(toPair)),
    holdoutBaseA: computeMetrics(holdout.map((p) => ({ actual: p.actual, pred: p.baseA, base: null }))),
    comparison: compareToBaselineA(holdout),
    inputSource: 'observed_only',
  }
}

function toPair(p: BacktestPoint): PredictionPair {
  return { actual: p.actual, pred: p.m1, base: p.baseA }
}

/** M1과 기준선 A의 절대오차 차이 → 평균 (ΔMAE), 블록 부트스트랩 구간, 판정. */
export function compareToBaselineA(points: BacktestPoint[]): ComparisonResult {
  const d: number[] = []
  for (const p of points) {
    if (p.m1 === null || p.baseA === null) continue
    d.push(Math.abs(p.actual - p.m1) - Math.abs(p.actual - p.baseA))
  }
  const ci = blockBootstrapMean(d)
  if (ci === null) {
    return { pair: 'M1 vs Baseline A', n: 0, deltaMae: null, lower: null, upper: null, verdict: null }
  }
  return {
    pair: 'M1 vs Baseline A',
    n: d.length,
    deltaMae: ci.mean,
    lower: ci.lower,
    upper: ci.upper,
    verdict: decideVerdict(ci.mean, ci.upper),
  }
}
