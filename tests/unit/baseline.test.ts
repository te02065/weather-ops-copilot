/**
 * 이 파일이 하는 일: analysis/baseline.ts 테스트 (기준선 A, B, C). 값은 손으로 계산해서 맞춥니다.
 * 입력: 합성 매출 (실제 아님). 2026-03-01은 일요일, 03-30은 월요일입니다.
 * 출력: 테스트 통과/실패
 *
 * 손 계산 근거 (매출 = 100 + 10 × i, i는 3월 1일부터 0):
 *   목표 2026-03-30(월). 직전 월요일은 03-02(i=1), 03-09(i=8), 03-16(i=15), 03-23(i=22).
 *   A = 마지막 4개 평균 = (110+180+250+320)/4 = 215
 *   B = 마지막 28개(i=1..28) 평균 = 100 + 10 × 14.5 = 245
 *   C = 마지막 7개(i=22..28) 평균 = 100 + 10 × 25 = 350
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFeatures } from '../../analysis/features'
import { baselineA, baselineB, baselineC } from '../../analysis/baseline'
import type { SalesInputRow } from '../../analysis/types'

function days(n: number): SalesInputRow[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 2, 1 + i)).toISOString().slice(0, 10)
    return { row: i + 2, date: d, sales: 100 + 10 * i, transactions: null, iceSales: null, hotSales: null, flags: [] }
  })
}

const TARGET = '2026-03-30'

test('기준선 A: 같은 요일 직전 4개 평균 (손 계산 215)', () => {
  const rows = buildFeatures({ sales: days(29), weather: [], events: [] }, '2026-03-29')
  const a = baselineA(rows, TARGET)
  assert.equal(a.method, 'A')
  assert.equal(a.value, 215)
  assert.equal(a.sample, 4)
  assert.equal(a.fallback, false)
})

test('기준선 B: 최근 28 유효 영업일 평균 (손 계산 245)', () => {
  const rows = buildFeatures({ sales: days(29), weather: [], events: [] }, '2026-03-29')
  assert.equal(baselineB(rows, TARGET).value, 245)
})

test('기준선 C: 최근 7 유효 영업일 평균 (손 계산 350)', () => {
  const rows = buildFeatures({ sales: days(29), weather: [], events: [] }, '2026-03-29')
  assert.equal(baselineC(rows, TARGET).value, 350)
})

test('기준선 A: 같은 요일 표본이 3개 미만이면 B로 바꾸고 fallback을 표시한다', () => {
  // 2026-03-15(일)을 목표로 하면 직전 일요일은 03-01(i=0), 03-08(i=7)뿐 → 2개
  const rows = buildFeatures({ sales: days(14), weather: [], events: [] }, '2026-03-14')
  const a = baselineA(rows, '2026-03-15')
  assert.equal(a.method, 'B')
  assert.equal(a.fallback, true)
  assert.equal(a.value, 165) // 0~13의 평균 = 100 + 10 × 6.5
})

test('기준선 A: 공휴일은 유효 영업일이 아니므로 표본에서 뺀다', () => {
  const sales = days(29)
  const events = [{ date: '2026-03-16', type: 'holiday' as const }]
  const rows = buildFeatures({ sales, weather: [], events }, '2026-03-29')
  const a = baselineA(rows, TARGET)
  // 월요일 직전 4개 중 03-16 제외 → 03-02, 03-09, 03-23 (i=1, 8, 22 → 110, 180, 320)
  assert.equal(a.sample, 3)
  assert.equal(a.value, (110 + 180 + 320) / 3)
  assert.equal(a.fallback, false)
})

test('목표일 이후 데이터는 기준선에 들어가지 않는다', () => {
  const rows = buildFeatures({ sales: days(35), weather: [], events: [] }, '2026-04-05')
  // 목표는 03-30이지만, 03-30 이후 값(i=29~)은 기준선에 들어가면 안 됨
  assert.equal(baselineC(rows, TARGET).value, 350)
})

test('표본이 하나도 없으면 값은 null', () => {
  const rows = buildFeatures({ sales: [], weather: [], events: [] }, '2026-03-29')
  assert.equal(baselineB(rows, TARGET).value, null)
  assert.equal(baselineB(rows, TARGET).sample, 0)
})
