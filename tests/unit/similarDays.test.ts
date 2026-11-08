/**
 * 이 파일이 하는 일: analysis/similarDays.ts 테스트 (요일·강수 구간·기온이 비슷한 날 찾기).
 * 입력: 작은 특징 행 목록
 * 출력: 테스트 통과/실패
 * 주의점: 기준 날짜 자신과 날씨가 없는 날은 목록에 들어가면 안 됩니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { similarDays } from '../../analysis/similarDays'
import type { FeatureRow } from '../../analysis/types'

function row(date: string, dow: number, y: number | null, rainBand: FeatureRow['rainBand'], tempAvg: number | null): FeatureRow {
  return { date, y, dow, isHoliday: false, isClosed: false, isPromo: false, rainBand, tempAvg, tempMax: null, tempMin: null, trendIdx: 0, weatherSource: 'observed', flags: [] }
}

test('같은 요일·같은 비 구간인 날만 고르고, 최근 날부터 보여 준다 (기온 조건은 없음)', () => {
  const rows = [
    row('2026-01-02', 5, 900000, 'heavy', 10),
    row('2026-01-09', 5, 700000, 'heavy', 12),
    row('2026-01-16', 5, 800000, 'none', 10),
    row('2026-01-23', 5, 850000, 'heavy', 20),
    row('2026-01-30', 4, 650000, 'heavy', 10),
    row('2026-02-06', 5, null, 'heavy', 11),
    row('2026-02-13', 5, 880000, 'heavy', 9),
    row('2026-02-20', 5, 600000, 'heavy', null),
  ]
  const r = similarDays(rows, '2026-02-13', '2026-02-20')
  assert.deepEqual(r.days.map((d) => d.date), ['2026-02-20', '2026-01-23', '2026-01-09', '2026-01-02'])
  assert.equal(r.avgSales, (600000 + 850000 + 700000 + 900000) / 4)
})

test('기준 날짜에 날씨가 없으면 목록을 비우고 평균을 null로 둔다', () => {
  const rows = [row('2026-01-02', 5, 900000, null, 10)]
  const r = similarDays(rows, '2026-01-02', '2026-01-02')
  assert.equal(r.count, 0)
  assert.equal(r.avgSales, null)
})
