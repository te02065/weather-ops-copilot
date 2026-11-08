/**
 * 이 파일이 하는 일: analysis/summary.ts 테스트 (요일별 평균과 지수, 일별 시계열).
 * 입력: 손으로 만든 특징 행 (합성 값)
 * 출력: 테스트 통과/실패
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { dowSummary, dailySeries } from '../../analysis/summary'
import type { FeatureRow } from '../../analysis/types'

function row(date: string, dow: number, y: number | null, extra: Partial<FeatureRow> = {}): FeatureRow {
  return {
    date, y, dow, isHoliday: false, isClosed: false, isPromo: false, rainBand: 'none',
    tempAvg: 10, tempMax: 10, tempMin: 10, trendIdx: 0, weatherSource: 'observed', flags: [], ...extra,
  }
}

test('요일 평균: 유효 영업일만 평균하고, 전체 평균 대비 지수를 구한다', () => {
  // 일요일 2일(200, 400) → 평균 300, 월요일 1일(100) → 평균 100, 전체 평균 (200+400+100)/3 = 233.33
  const rows = [row('2026-03-01', 0, 200), row('2026-03-08', 0, 400), row('2026-03-02', 1, 100)]
  const d = dowSummary(rows)
  assert.equal(d[0]!.avgSales, 300)
  assert.equal(d[0]!.count, 2)
  assert.ok(Math.abs(d[0]!.index - 300 / (700 / 3)) < 1e-9)
  assert.equal(d[2]!.count, 0)
})

test('휴무 후보와 공휴일은 요일 평균에서 뺀다', () => {
  const rows = [row('2026-03-01', 0, 200), row('2026-03-08', 0, 0, { isClosed: true }), row('2026-03-15', 0, 900, { isHoliday: true })]
  assert.equal(dowSummary(rows)[0]!.count, 1)
})

test('일별 시계열은 날짜순이고 매출이 없는 날은 뺀다', () => {
  const s = dailySeries([row('2026-03-02', 1, 5), row('2026-03-01', 0, null), row('2026-03-03', 2, 7)])
  assert.deepEqual(s.map((p) => p.date), ['2026-03-02', '2026-03-03'])
})

test('구간별 표본 수: 기준일 이전 유효 영업일 중 강수 구간별로 센다', () => {
  const { bandCounts } = require('../../analysis/summary') as typeof import('../../analysis/summary')
  const rows = [row('2026-03-01', 0, 1, { rainBand: 'light' }), row('2026-03-02', 1, 2, { rainBand: 'heavy' }), row('2026-03-09', 1, 3, { rainBand: 'heavy' })]
  const c = bandCounts(rows, '2026-03-05')
  assert.deepEqual(c, { light: 1, heavy: 1, training: 2 })
})
