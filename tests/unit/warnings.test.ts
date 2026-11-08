/**
 * 이 파일이 하는 일: analysis/warnings.ts와 analysis/outliers.ts 테스트 (W_GAPS, W_ZERO_SALES, W_OUTLIER, W_NO_TRANSACTIONS, 중앙값·MAD).
 * 입력: 합성 행 (테스트 안에 직접 적음)
 * 출력: 테스트 통과/실패
 * 주의점: 2026-01-05는 월요일입니다 (UTC 기준). 요일 테스트는 이 날짜를 기준으로 씁니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { checkGaps, zeroSalesWarnings, outlierWarnings, transactionsWarning, optionalMissingInfo } from '../../analysis/warnings'
import { median, mad, findOutlierRows } from '../../analysis/outliers'
import type { SalesInputRow } from '../../analysis/types'

function row(r: number, date: string, sales: number | null): SalesInputRow {
  return { row: r, date, sales, transactions: null, iceSales: null, hotSales: null, flags: [] }
}

/** 2026-01-05부터 7일 간격의 월요일 행들. 값 목록을 넣으면 순서대로 채웁니다. */
function mondays(values: number[]): SalesInputRow[] {
  const dates = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']
  return values.map((v, i) => row(i + 2, dates[i]!, v))
}

test('중앙값: 홀수 개와 짝수 개 모두 맞다', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([]), 0)
})

test('MAD: 중앙값에서 떨어진 거리의 중앙값이다', () => {
  assert.equal(mad([1, 2, 3, 4, 100], 3), 1)
})

test('이상치: 같은 요일 중앙값에서 크게 벗어난 날만 찾는다 (자동 삭제 없음)', () => {
  const rows = mondays([100, 101, 99, 100, 102, 98, 500])
  assert.deepEqual(findOutlierRows(rows), [8]) // 마지막 월요일(행 8)만 이상치
})

test('이상치: 요일 표본이 기준보다 적으면 계산하지 않는다', () => {
  assert.deepEqual(findOutlierRows(mondays([100, 101, 500])), [])
})

test('이상치: 같은 값만 있으면 편차 기준을 세울 수 없어 아무것도 찾지 않는다', () => {
  assert.deepEqual(findOutlierRows(mondays([100, 100, 100, 100, 100, 100, 100])), [])
})

test('W_GAPS: 날짜가 빠지면 개수와 첫 누락일을 알려 준다', () => {
  const rows = [row(2, '2026-01-01', 1), row(3, '2026-01-02', 1), row(4, '2026-01-05', 1)]
  const w = checkGaps(rows)
  assert.equal(w[0]!.code, 'W_GAPS')
  assert.match(w[0]!.message, /2일 빠져/)
  assert.match(w[0]!.message, /2026-01-03/)
})

test('W_GAPS: 빠진 날이 없으면 경고가 없다', () => {
  const rows = [row(2, '2026-01-01', 1), row(3, '2026-01-02', 1)]
  assert.deepEqual(checkGaps(rows), [])
})

test('W_ZERO_SALES: 매출 0원 행마다 휴무 후보로 알려 준다', () => {
  const w = zeroSalesWarnings([row(4, '2026-01-03', 0), row(5, '2026-01-04', 100)])
  assert.match(w[0]!.message, /파일 4번째 줄 \(2026-01-03\)/)
  assert.equal(w.length, 1)
  assert.equal(w[0]!.code, 'W_ZERO_SALES')
  assert.equal(w[0]!.row, 4)
})

test('W_OUTLIER: 이상치 행마다 경고를 만들고, 메시지에 금액이 없다', () => {
  const w = outlierWarnings([row(8, '2026-01-07', 500000)])
  assert.equal(w[0]!.code, 'W_OUTLIER')
  assert.equal(w[0]!.row, 8)
  assert.match(w[0]!.message, /파일 8번째 줄 \(2026-01-07\)/)
  assert.doesNotMatch(w[0]!.message, /500000/)
})

test('W_OUTLIER: 시트 이름 표기를 넣으면 시트 이름과 날짜로 가리킨다', () => {
  const w = outlierWarnings([row(8, '2026-01-07', 500000)], (r) => `'결제 합계' 시트 ${r.date} 행`)
  assert.equal(w[0]!.message, "'결제 합계' 시트 2026-01-07 행: 평소보다 많이 팔린 날이에요. 명절이나 공휴일이면 정상입니다.")
})

test('I_OPTIONAL_MISSING: 선택 열을 골랐는데 헤더에 없으면 정보를 남기고, 있으면 없다', () => {
  const fields = ['date', 'sales']
  const info = optionalMissingInfo(fields, { date: 'date', sales: 'sales', iceSales: 'ice_sales' })
  assert.equal(info.length, 1)
  assert.equal(info[0]!.code, 'I_OPTIONAL_MISSING')
  assert.match(info[0]!.message, /'ice_sales'/)
  assert.deepEqual(optionalMissingInfo(['date', 'sales', 'ice_sales'], { date: 'date', sales: 'sales', iceSales: 'ice_sales' }), [])
})

test('W_NO_TRANSACTIONS: 거래 수 열이 없으면 정보 경고, 있으면 없다', () => {
  assert.equal(transactionsWarning(false)[0]!.code, 'W_NO_TRANSACTIONS')
  assert.deepEqual(transactionsWarning(true), [])
})
