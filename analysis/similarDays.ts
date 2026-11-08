/**
 * 이 파일이 하는 일: 선택한 날과 요일·강수 구간·기온이 비슷했던 과거 날을 찾아 평균 매출을 구합니다.
 * 입력: 특징 행 목록, 기준 날짜(선택한 날), 기준일(cutoff)
 * 출력: 비슷한 날 목록(최근순, 최대 개수 제한), 전체 평균 매출, 표본 수
 * 주의점: 날씨가 빠진 날과 유효 영업일이 아닌 날은 세지 않습니다. 평균은 "같이 있었던 날의 차이"일 뿐 인과 효과가 아닙니다.
 *         기준 날짜의 날씨는 과거 관측값입니다. 예보 날씨를 쓰는 기능이 아닙니다.
 */

import { CONFIG } from './config'
import { isValidDay } from './features'
import type { FeatureRow } from './types'

export interface SimilarDay { date: string; sales: number; tempAvg: number }
export interface SimilarResult {
  target: FeatureRow | null
  days: SimilarDay[]     // 최근 날짜 순, 최대 CONFIG.similarMaxList개
  count: number          // 조건에 맞은 날 전체 수 (목록 제한 전)
  avgSales: number | null
}

export function similarDays(rows: FeatureRow[], targetDate: string, cutoff: string): SimilarResult {
  const target = rows.find((r) => r.date === targetDate) ?? null
  if (!target || target.rainBand === null || target.tempAvg === null) {
    return { target, days: [], count: 0, avgSales: null }
  }
  const matches = rows
    .filter((r) => r.date !== targetDate && r.date <= cutoff && isValidDay(r))
    .filter((r) => r.dow === target.dow && r.rainBand === target.rainBand)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const sales = matches.map((r) => r.y as number)
  const avg = sales.length === 0 ? null : sales.reduce((s, x) => s + x, 0) / sales.length
  return {
    target,
    count: matches.length,
    avgSales: avg,
    days: matches.slice(0, CONFIG.similarMaxList).map((r) => ({ date: r.date, sales: r.y as number, tempAvg: r.tempAvg! })),
  }
}
