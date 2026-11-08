/**
 * 이 파일이 하는 일: analysis/threeCriteria.ts 테스트 (①같은 요일, ②작년 같은 날, ③같은 날씨).
 * 입력: 작은 특징 행 목록과 예보 예시
 * 출력: 테스트 통과/실패
 * 주의점: 표본 8일 미만은 값을 숨깁니다. 강수확률만 있으면 두 구간 범위를 씁니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { probabilityBands, threeCriteria } from '../../analysis/threeCriteria'
import type { FeatureRow } from '../../analysis/types'

function row(date: string, dow: number, y: number, rainBand: FeatureRow['rainBand']): FeatureRow {
  return { date, y, dow, isHoliday: false, isClosed: false, isPromo: false, rainBand, tempAvg: 10, tempMax: null, tempMin: null, trendIdx: 0, weatherSource: 'observed', flags: [] }
}

test('① 같은 요일: 8일 이상이면 평균, 미만이면 null', () => {
  const rows: FeatureRow[] = []
  for (let i = 0; i < 8; i++) rows.push(row(`2026-10-${String(i * 7 + 1).padStart(2, '0')}`, 5, 100, 'none'))
  const c = threeCriteria(rows, '2026-11-04', '2026-11-06', null)
  assert.equal(c.dow, 5)
  assert.equal(c.sameWeekday.avg, 100)
  assert.equal(c.sameWeekday.n, 8)
  const few = threeCriteria(rows.slice(0, 3), '2026-11-04', '2026-11-06', null)
  assert.equal(few.sameWeekday.avg, null)
})

test('② 작년 같은 날: 1건이면 그 날 매출 (평균이라고 쓰지 않음)', () => {
  const rows = [row('2025-11-09', 0, 555000, 'none')]
  const c = threeCriteria(rows, '2026-11-08', '2026-11-09', null)
  assert.equal(c.lastYear.sales, 555000)
  assert.equal(c.lastYear.note, 'single')
})

test('③ 같은 날씨: 강수량이 있으면 그 구간, 강수확률만 있으면 두 구간 범위', () => {
  const rows: FeatureRow[] = []
  for (let i = 0; i < 8; i++) rows.push(row(`2026-09-${String(i + 1).padStart(2, '0')}`, 1, 300000, 'light'))
  for (let i = 0; i < 8; i++) rows.push(row(`2026-09-${String(i + 15).padStart(2, '0')}`, 1, 500000, 'none'))
  for (let i = 0; i < 8; i++) rows.push(row(`2026-08-${String(i + 1).padStart(2, '0')}`, 1, 700000, 'heavy'))
  const exact = threeCriteria(rows, '2026-11-08', '2026-11-09', { date: '2026-11-09', precipMm: 3, tempAvg: 10, tempMax: null, tempMin: null, windMs: null })
  assert.equal(exact.weatherLabel, '약한 비')
  assert.equal(exact.sameWeather.avg, 300000)
  const prob = threeCriteria(rows, '2026-11-08', '2026-11-09', { date: '2026-11-09', precipMm: null, tempAvg: 10, tempMax: null, tempMin: null, windMs: null, rainProbPct: 40 })
  assert.equal(prob.probabilityOnly, true)
  assert.deepEqual(prob.sameWeather.range, [300000, 700000])
})

test('강수확률 구간: 낮음 30% 미만, 높음 60% 이상', () => {
  assert.deepEqual(probabilityBands(10), ['none', 'light'])
  assert.deepEqual(probabilityBands(45), ['light', 'heavy'])
  assert.deepEqual(probabilityBands(80), ['heavy', 'light'])
})
