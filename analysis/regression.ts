/**
 * 이 파일이 하는 일: 날씨 포함 로그 선형 회귀 M1을 학습하고 예측합니다 (방법론 §6.4).
 * 입력: 특징 행 목록(FeatureRow), 기준일(cutoff)
 * 출력: M1 모델 (계수, 뺀 항, smearing 보정값), 예측 매출, 효과(%)
 * 주의점: log(매출)을 설명하는 모델이므로 예측할 때 Duan smearing 보정을 꼭 곱합니다. 빼면 평균이 낮아집니다.
 *         학습 대상은 목표일 직전 최대 365일의 유효 영업일이고, 날씨(강수 구간, 기온)가 있는 날만 씁니다.
 *         기준 요일은 일요일(0)입니다. 랭크 부족으로 빠진 항은 dropped에 기록하고 효과는 0으로 봅니다.
 *         기준 숫자(365, ridge 1e-8)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'
import { solveNormal } from './ols'
import { isValidDay } from './features'
import { addDaysIso } from './dates'
import type { FeatureRow } from './types'

export const M1_VERSION = '1.0.0'
export const M1_COLUMNS = [
  'intercept', 'dow1', 'dow2', 'dow3', 'dow4', 'dow5', 'dow6',
  'holiday', 'promo', 'trend', 'rain_light', 'rain_heavy', 'temp',
] as const
export type M1Column = (typeof M1_COLUMNS)[number]

export interface M1Model {
  version: string
  n: number                         // 학습 행 수
  beta: Record<M1Column, number>    // 빠진 항은 0
  dropped: M1Column[]               // 랭크 부족으로 뺀 항
  smearing: number                  // Duan smearing 보정 s = mean(exp(잔차))
}

/** 설계 행 한 줄. 기준 요일(일요일)과 기준 강수(none)는 열이 없습니다. */
export function designRow(r: FeatureRow): number[] {
  const dowDummies = [1, 2, 3, 4, 5, 6].map((d) => (r.dow === d ? 1 : 0))
  return [
    1, ...dowDummies,
    r.isHoliday ? 1 : 0,
    r.isPromo ? 1 : 0,
    r.trendIdx,
    r.rainBand === 'light' ? 1 : 0,
    r.rainBand === 'heavy' ? 1 : 0,
    r.tempAvg ?? 0,
  ]
}

/** 학습에 쓸 행: 유효 영업일이면서 날씨(강수, 기온)가 있고, 기준일 직전 365일 안에 있는 날. */
export function trainingRows(rows: FeatureRow[], cutoff: string): FeatureRow[] {
  const from = addDaysIso(cutoff, -CONFIG.maxTrainWindowDays)
  return rows.filter((r) =>
    r.date <= cutoff && r.date > from && isValidDay(r) && r.rainBand !== null && r.tempAvg !== null)
}

export function trainM1(rows: FeatureRow[], cutoff: string): M1Model {
  const train = trainingRows(rows, cutoff)
  const X = train.map(designRow)
  const y = train.map((r) => Math.log(r.y as number))
  const { beta, dropped } = solveNormal(X, y, CONFIG.ridgeLambda)
  const coef = Object.fromEntries(M1_COLUMNS.map((name, i) => [name, beta[i] ?? 0])) as Record<M1Column, number>
  const droppedNames = dropped.map((i) => M1_COLUMNS[i]!)
  const resid = train.map((r, k) => Math.log(r.y as number) - dot(X[k]!, Object.values(coef)))
  const smearing = resid.length === 0 ? 1 : resid.reduce((s, e) => s + Math.exp(e), 0) / resid.length
  return { version: M1_VERSION, n: train.length, beta: coef, dropped: droppedNames, smearing }
}

/** 예측 매출 = exp(xβ) × smearing. */
export function predictM1(model: M1Model, r: FeatureRow): number | null {
  if (r.rainBand === null || r.tempAvg === null) return null
  const eta = dot(designRow(r), M1_COLUMNS.map((c) => model.beta[c]))
  return Math.exp(eta) * model.smearing
}

/** 효과 (%): 강수 구간은 exp(θ) − 1, 기온은 1℃당 exp(κ) − 1. */
export function effectsPct(model: M1Model): { rainLight: number; rainHeavy: number; tempPerC: number } {
  return {
    rainLight: (Math.exp(model.beta.rain_light) - 1) * 100,
    rainHeavy: (Math.exp(model.beta.rain_heavy) - 1) * 100,
    tempPerC: (Math.exp(model.beta.temp) - 1) * 100,
  }
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i]!, 0)
}
