/**
 * 이 파일이 하는 일: 같은 요일 중앙값에서 크게 벗어난 날(이상치 후보)을 찾습니다.
 * 입력: SalesInputRow 배열 (매출이 0보다 큰 날만 봅니다)
 * 출력: 이상치 후보 행의 row 번호 배열
 * 주의점: 이상치는 "플래그만" 답니다. 자동으로 지우지 않습니다 (방법론 G6).
 *         기준 편차는 "1.4826 × MAD"(보정 MAD)입니다. 방법론 G6 v1.1.1에 적었습니다.
 *         보정 없이 쓰면 ±4 MAD는 약 ±2.7σ가 되어 기준이 실제로 더 엄격해집니다.
 *         기준 숫자(±4, 1.4826, 최소 표본 4)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'
import { dayOfWeek } from './dates'
import type { SalesInputRow } from './types'

/** 중앙값. 빈 배열이면 0을 돌려줍니다 (호출하는 쪽에서 표본 수를 먼저 확인합니다). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** 중앙값 절대편차 (MAD): 중앙값에서 떨어진 거리의 중앙값. */
export function mad(xs: number[], center: number): number {
  return median(xs.map((x) => Math.abs(x - center)))
}

/** 요일별로 묶어서 이상치 후보의 row 번호를 돌려줍니다. */
export function findOutlierRows(rows: SalesInputRow[]): number[] {
  const valid = rows.filter((r) => r.sales !== null && r.sales > 0)
  const found: number[] = []
  for (let dow = 0; dow < 7; dow++) {
    const group = valid.filter((r) => dayOfWeek(r.date) === dow)
    if (group.length < CONFIG.outlierMinSamplePerWeekday) continue
    const values = group.map((r) => r.sales as number)
    const center = median(values)
    const sigma = CONFIG.madScale * mad(values, center) // 보정 MAD
    if (sigma === 0) continue // 모두 같은 값이면 편차 기준을 세울 수 없습니다
    for (const r of group) {
      if (Math.abs((r.sales as number) - center) > CONFIG.outlierMad * sigma) found.push(r.row)
    }
  }
  return found.sort((a, b) => a - b)
}
