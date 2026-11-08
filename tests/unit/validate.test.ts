/**
 * 이 파일이 하는 일: analysis/validate.ts 테스트 (E_NO_DATE_COL, E_NO_SALES_COL, E_NEGATIVE, E_DUP_DATE, E_TOO_SHORT).
 * 입력: 합성 행과 헤더 목록 (테스트 안에 직접 적음)
 * 출력: 테스트 통과/실패
 * 주의점: 기준 56일은 analysis/config.ts에서 가져옵니다. 테스트에서도 CONFIG 값을 씁니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG } from '../../analysis/config'
import { checkMapping, checkNegativeSales, checkDuplicateDates, checkMinLength } from '../../analysis/validate'
import type { SalesInputRow } from '../../analysis/types'

function row(r: number, date: string, sales: number | null): SalesInputRow {
  return { row: r, date, sales, transactions: null, iceSales: null, hotSales: null, flags: [] }
}

/** i번째 날짜 (2026-01-01부터 하루씩 증가). 중복 없이 연속된 날짜를 만듭니다. */
function dayAt(i: number): string {
  return new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
}

test('날짜 열을 지정하지 않으면 E_NO_DATE_COL', () => {
  const errors = checkMapping(['date', 'sales'], { date: '', sales: 'sales' })
  assert.equal(errors[0]!.code, 'E_NO_DATE_COL')
})

test('지정한 날짜 열이 헤더에 없으면 E_NO_DATE_COL, 메시지에 열 이름이 들어간다', () => {
  const errors = checkMapping(['day', 'sales'], { date: 'date', sales: 'sales' })
  assert.equal(errors[0]!.code, 'E_NO_DATE_COL')
  assert.match(errors[0]!.message, /'date'/)
})

test('매출 열을 지정하지 않거나 헤더에 없으면 E_NO_SALES_COL', () => {
  assert.equal(checkMapping(['date', 'sales'], { date: 'date', sales: '' })[0]!.code, 'E_NO_SALES_COL')
  assert.equal(checkMapping(['date', 'won'], { date: 'date', sales: 'sales' })[0]!.code, 'E_NO_SALES_COL')
})

test('열이 모두 맞으면 매핑 오류가 없다', () => {
  assert.deepEqual(checkMapping(['date', 'sales'], { date: 'date', sales: 'sales' }), [])
})

test('음수 매출은 E_NEGATIVE, 메시지에 금액이 없다', () => {
  const errors = checkNegativeSales([row(3, '2026-01-03', -5000)])
  assert.equal(errors[0]!.code, 'E_NEGATIVE')
  assert.equal(errors[0]!.row, 3)
  assert.doesNotMatch(errors[0]!.message, /5000/)
})

test('0원은 음수가 아니므로 E_NEGATIVE가 아니다', () => {
  assert.equal(checkNegativeSales([row(3, '2026-01-03', 0)]).length, 0)
})

test('같은 날짜가 두 번 나오면 두 번째 행에 E_DUP_DATE', () => {
  const errors = checkDuplicateDates([row(2, '2026-01-01', 1), row(3, '2026-01-01', 2)])
  assert.equal(errors.length, 1)
  assert.equal(errors[0]!.code, 'E_DUP_DATE')
  assert.equal(errors[0]!.row, 3)
})

test('유효 영업일이 기준보다 적으면 E_TOO_SHORT', () => {
  const rows = Array.from({ length: CONFIG.minTrainDays - 1 }, (_, i) => row(i + 2, dayAt(i), 1000))
  assert.equal(checkMinLength(rows)[0]!.code, 'E_TOO_SHORT')
})

test('유효 영업일이 기준과 같으면 E_TOO_SHORT가 아니다', () => {
  const rows = Array.from({ length: CONFIG.minTrainDays }, (_, i) => row(i + 2, dayAt(i), 1000))
  assert.deepEqual(checkMinLength(rows), [])
})

test('매출 0원인 날은 유효 영업일에 세지 않는다', () => {
  const rows = Array.from({ length: CONFIG.minTrainDays }, (_, i) => row(i + 2, dayAt(i), i === 0 ? 0 : 1000))
  assert.equal(checkMinLength(rows)[0]!.code, 'E_TOO_SHORT')
})
