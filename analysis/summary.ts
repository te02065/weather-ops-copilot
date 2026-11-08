/**
 * 이 파일이 하는 일: 화면 차트에 쓸 요약 값을 만듭니다. 원시 상관은 만들지 않습니다 (방법론 §5.1).
 * 입력: 특징 행 목록 (FeatureRow)
 * 출력: 요일별 평균 (유효 영업일만), 일별 매출 시계열
 * 주의점: 요일 평균은 "요일별 차이"를 보여 줄 뿐, 날씨 효과가 아닙니다. 화면에서도 그렇게 표시합니다.
 */

import { isValidDay } from './features'
import { trainingRows } from './regression'
import type { FeatureRow } from './types'

export interface DowRow {
  dow: number          // 0(일)~6(토)
  avgSales: number     // 해당 요일 유효 영업일 평균 매출
  index: number        // 전체 평균 대비 배율 (1.10 = +10%)
  count: number        // 표본 수
}

export interface DailySalesPoint {
  date: string
  sales: number
}

export function dowSummary(rows: FeatureRow[]): DowRow[] {
  const valid = rows.filter(isValidDay)
  const overall = valid.length === 0 ? 0 : valid.reduce((s, r) => s + (r.y as number), 0) / valid.length
  return Array.from({ length: 7 }, (_, dow) => {
    const xs = valid.filter((r) => r.dow === dow).map((r) => r.y as number)
    const avg = xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length
    return {
      dow,
      avgSales: avg,
      index: overall === 0 ? 1 : avg / overall,
      count: xs.length,
    }
  })
}

/** 매출이 있는 날의 시계열 (날짜순). 휴무 후보(0원)도 그대로 둡니다. */
export function dailySeries(rows: FeatureRow[]): DailySalesPoint[] {
  return rows
    .filter((r) => r.y !== null)
    .map((r) => ({ date: r.date, sales: r.y as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** 학습에 쓴 강수 구간별 표본 수 (효과 배지에 표시). 모델 학습과 같은 기준(최근 365일)을 씁니다. */
export function bandCounts(rows: FeatureRow[], cutoff: string): { light: number; heavy: number; training: number } {
  const train = trainingRows(rows, cutoff) // 모델이 실제로 학습한 행과 같은 기준
  return {
    light: train.filter((r) => r.rainBand === 'light').length,
    heavy: train.filter((r) => r.rainBand === 'heavy').length,
    training: train.length,
  }
}
