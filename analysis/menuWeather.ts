/**
 * 이 파일이 하는 일: 날씨별로 POS 카테고리와 메뉴의 평균 하루 매출을 계산합니다 (설명용 집계, 모델 아님).
 * 입력: 메뉴별 일 매출 (PosReport.menuDaily), 날짜별 특징 행 (FeatureRow: 강수 구간과 유효 영업일 여부)
 * 출력: 카테고리(또는 메뉴) × 강수 구간(없음·약함·강함)별 평균 하루 매출과 표본 일 수
 * 주의점: 유효 영업일만 셉니다. 표본이 CONFIG.minBandDays보다 적으면 평균을 null로 둡니다.
 *         "날씨 때문에"라고 단정하지 않습니다. 같은 날씨였던 날들의 평균 차이입니다.
 */

import { CONFIG } from './config'
import { isValidDay } from './features'
import type { MenuDaily } from './posReport'
import type { FeatureRow } from './types'

export type Band = 'none' | 'light' | 'heavy'
export interface BandStat { avgPerDay: number | null; days: number }
export type BandTable = Record<Band, BandStat>

/** 날짜별 합계를 먼저 만든 뒤 강수 구간별로 평균을 냅니다 (하루 매출의 평균). */
export function categoryByBand(menu: MenuDaily[], features: FeatureRow[], pick: (m: MenuDaily) => string): Record<string, BandTable> {
  const bandOf = new Map<string, Band>()
  for (const f of features) if (isValidDay(f) && f.rainBand !== null) bandOf.set(f.date, f.rainBand)
  const daily = new Map<string, Map<string, number>>()
  for (const m of menu) {
    if (!bandOf.has(m.date)) continue
    const k = pick(m)
    const day = daily.get(k) ?? new Map<string, number>()
    day.set(m.date, (day.get(m.date) ?? 0) + m.amount)
    daily.set(k, day)
  }
  const out: Record<string, BandTable> = {}
  for (const [k, perDate] of Array.from(daily.entries())) {
    out[k] = bandTable(Array.from(bandOf.entries()).map(([date, band]) => ({ band, amount: perDate.get(date) ?? 0 })))
  }
  return out
}

function bandTable(rows: Array<{ band: Band; amount: number }>): BandTable {
  const table = {} as BandTable
  for (const band of ['none', 'light', 'heavy'] as Band[]) {
    const xs = rows.filter((r) => r.band === band).map((r) => r.amount)
    const days = xs.length
    table[band] = { days, avgPerDay: days < CONFIG.minBandDays ? null : xs.reduce((s, x) => s + x, 0) / days }
  }
  return table
}

/** 금액 합계가 큰 이름 상위 n개 (표시 개수 제한용). */
export function topNames(menu: MenuDaily[], n: number, pick: (m: MenuDaily) => string): string[] {
  const sums = new Map<string, number>()
  for (const m of menu) sums.set(pick(m), (sums.get(pick(m)) ?? 0) + m.amount)
  return Array.from(sums.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
}
