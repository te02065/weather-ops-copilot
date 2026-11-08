/**
 * 이 파일이 하는 일: 날씨를 쓰지 않는 기준선 예측 A, B, C를 계산합니다 (방법론 §6.1~6.3).
 * 입력: 특징 행 목록(FeatureRow), 목표일
 * 출력: 기준선 값, 방식, 대체 여부(fallback), 표본 수
 * 주의점: 목표일 이전의 유효 영업일만 씁니다 (목표일 자신과 이후 날짜는 쓰지 않음).
 *         A는 같은 요일 직전 유효 영업일 4개의 평균입니다. 3개 미만이면 B로 바꾸고 fallback을 true로 표시합니다.
 *         표본 개수(4, 3, 28, 7)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'
import { dayOfWeek } from './dates'
import { isValidDay } from './features'
import type { FeatureRow } from './types'

export interface BaselineValue {
  method: 'A' | 'B' | 'C'
  value: number | null  // 표본이 없으면 null
  sample: number        // 실제로 쓴 표본 수
  fallback: boolean     // A가 B로 대체되었는지
}

/** 목표일 이전의 유효 영업일 매출만 날짜순으로 모읍니다. */
function validBefore(rows: FeatureRow[], target: string): FeatureRow[] {
  return rows
    .filter((r) => r.date < target && isValidDay(r))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/** 최근 n개의 유효 영업일 평균 (B, C). */
function recentMean(rows: FeatureRow[], target: string, n: number, method: 'B' | 'C'): BaselineValue {
  const last = validBefore(rows, target).slice(-n)
  return { method, value: mean(last.map((r) => r.y as number)), sample: last.length, fallback: false }
}

/** 같은 요일 직전 유효 영업일 평균 (A). 표본이 부족하면 B로 대체합니다. */
export function baselineA(rows: FeatureRow[], target: string): BaselineValue {
  const dow = dayOfWeek(target)
  const sameDow = validBefore(rows, target).filter((r) => r.dow === dow).slice(-CONFIG.baselineASampleCount)
  if (sameDow.length < CONFIG.baselineAMinCount) {
    return { ...recentMean(rows, target, CONFIG.baselineBDays, 'B'), fallback: true }
  }
  return { method: 'A', value: mean(sameDow.map((r) => r.y as number)), sample: sameDow.length, fallback: false }
}

export function baselineB(rows: FeatureRow[], target: string): BaselineValue {
  return recentMean(rows, target, CONFIG.baselineBDays, 'B')
}

export function baselineC(rows: FeatureRow[], target: string): BaselineValue {
  return recentMean(rows, target, CONFIG.baselineCDays, 'C')
}
