/**
 * 이 파일이 하는 일: analysis/dashboardStats.ts 테스트 (날씨 묶음, 요일×비 표, 기온 급변, 기본 통계, 달력 칸).
 * 입력: 작은 특징 행 목록
 * 출력: 테스트 통과/실패
 * 주의점: 휴무(매출 0)와 날씨 없는 날은 평균에서 빠져야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { basicStats, dowWeatherTable, monthMarks, tempChanges, weatherGroups } from '../../analysis/dashboardStats'
import type { FeatureRow } from '../../analysis/types'

function row(date: string, dow: number, y: number | null, rainBand: FeatureRow['rainBand'], tempAvg: number | null, tempDelta?: number): FeatureRow {
  return { date, y, dow, isHoliday: false, isClosed: false, isPromo: false, rainBand, tempAvg, tempMax: null, tempMin: null, tempDelta, trendIdx: 0, weatherSource: 'observed', flags: [] }
}

test('날씨 묶음 평균: 휴무와 날씨 없는 날은 뺀다', () => {
  const rows = [
    row('2026-01-01', 4, 1000, 'none', 3),
    row('2026-01-02', 5, 800, 'heavy', 30),
    row('2026-01-03', 5, 0, 'none', 3),
    row('2026-01-04', 6, 600, null, 10),
  ]
  const g = Object.fromEntries(weatherGroups(rows).map((x) => [x.key, x]))
  assert.equal(g.none!.count, 1)
  assert.equal(g.none!.avgSales, 1000)
  assert.equal(g.heavy!.avgSales, 800)
  assert.equal(g.cold!.count, 1)
  assert.equal(g.hot!.count, 1)
})

test('요일×비 표: 표본이 8일 미만이면 평균을 숨긴다', () => {
  const t = dowWeatherTable([row('2026-01-02', 5, 900, 'light', 10)])
  assert.equal(t[5]!.light.count, 1)
  assert.equal(t[5]!.light.avgSales, null)
})

test('기온 급변: 전날 대비 10℃ 이상 바뀐 날과 매출 변화', () => {
  const c = tempChanges([
    row('2026-01-01', 4, 1000, 'none', 5, 0),
    row('2026-01-02', 5, 800, 'none', 16, 11),
    row('2026-01-03', 6, 900, 'none', 15, -1),
  ])
  assert.equal(c.length, 1)
  assert.equal(c[0]!.date, '2026-01-02')
  assert.equal(c[0]!.changePct, -20)
})

test('기본 통계: 최고·최저 날, 평일·주말 평균', () => {
  const s = basicStats([
    row('2026-01-01', 4, 1000, 'none', 5),
    row('2026-01-03', 6, 1400, 'none', 5),
    row('2026-01-04', 0, 600, 'none', 5),
  ])
  assert.equal(s.max!.date, '2026-01-03')
  assert.equal(s.min!.date, '2026-01-04')
  assert.equal(s.range, 800)
  assert.equal(s.weekdayAvg, 1000)
  assert.equal(s.weekendAvg, 1000)
})

test('달력 칸: 그 달의 날짜 수만큼 만들고, 자료 없는 날은 매출 null', () => {
  const marks = monthMarks([row('2026-02-03', 2, 700, 'none', 5)], '2026-02')
  assert.equal(marks.length, 28)
  assert.equal(marks[2]!.sales, 700)
  assert.equal(marks[0]!.sales, null)
})
