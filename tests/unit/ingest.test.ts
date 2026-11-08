/**
 * 이 파일이 하는 일: analysis/ingest.ts 전체 흐름 테스트 (합성 픽스처 3개, 오류 형식, 로그 기록).
 * 입력: tests/fixtures/synthetic/ 의 합성 CSV 3개, 그리고 테스트 안에 적은 작은 CSV
 * 출력: 테스트 통과/실패
 * 주의점: 로그 테스트는 매출 값(2500000)이 로그 줄에 나오지 않는지 확인합니다.
 *         픽스처 파일은 "합성 데이터"입니다. 실제 파일을 넣지 마세요.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ingestSalesCsv } from '../../analysis/ingest'
import { configureLogger } from '../../analysis/logger'
import type { ColumnMapping } from '../../analysis/types'

const MAPPING: ColumnMapping = {
  date: 'date',
  sales: 'sales',
  transactions: 'transactions',
  iceSales: 'ice_sales',
  hotSales: 'hot_sales',
}

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', name), 'utf-8')
}

/** 로그를 메모리에 모으는 설정. 테스트마다 새로 만듭니다. */
function captureLogs(): string[] {
  const lines: string[] = []
  configureLogger({ runId: 'test-run', sink: (line) => lines.push(line) })
  return lines
}

function codes(items: Array<{ code: string }>): string[] {
  return Array.from(new Set(items.map((i) => i.code))).sort()
}

test('정상 합성 자료: 오류 없음, 경고는 누락·휴무 후보·이상치', () => {
  captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_valid.csv'), MAPPING)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(codes(result.warnings), ['W_GAPS', 'W_OUTLIER', 'W_ZERO_SALES'])
  assert.equal(result.summary.zeroDays, 1)
})

test('날짜 오류 합성 자료: E_BAD_DATE가 나오고 실패한다', () => {
  captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_bad_date.csv'), MAPPING)
  assert.equal(result.ok, false)
  assert.deepEqual(codes(result.errors), ['E_BAD_DATE'])
  assert.equal(result.errors[0]!.stage, 'ingest.validate')
})

test('기간 짧은 합성 자료: E_TOO_SHORT가 나온다', () => {
  captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_short.csv'), MAPPING)
  assert.equal(result.ok, false)
  assert.deepEqual(codes(result.errors), ['E_TOO_SHORT'])
})

test('선택 열이 파일에 없으면 I_OPTIONAL_MISSING을 남기고 분석은 계속한다', () => {
  const lines = captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_valid.csv'), { ...MAPPING, iceSales: 'no_such_col' })
  assert.equal(result.ok, true)
  assert.ok(result.warnings.some((w) => w.code === 'I_OPTIONAL_MISSING'))
  assert.ok(lines.some((l) => l.includes('I_OPTIONAL_MISSING')), '로그에도 남아야 합니다')
})

test('오류 로그에는 해결 방법(hint)이 함께 남는다', () => {
  const lines = captureLogs()
  ingestSalesCsv(fixture('synthetic_bad_date.csv'), MAPPING)
  const errorLine = lines.map((l) => JSON.parse(l)).find((r) => r.code === 'E_BAD_DATE')
  assert.ok(errorLine.hint.length > 0)
})

test('매핑한 날짜 열이 없으면 E_NO_DATE_COL로 멈추고 날짜 검사는 하지 않는다', () => {
  captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_valid.csv'), { ...MAPPING, date: 'day' })
  assert.deepEqual(codes(result.errors), ['E_NO_DATE_COL'])
  assert.equal(result.rows.length, 0)
})

test('빈 파일은 E_CSV_PARSE이고 단계는 ingest.parse이다', () => {
  captureLogs()
  const result = ingestSalesCsv('', MAPPING)
  assert.equal(result.ok, false)
  assert.equal(result.errors[0]!.code, 'E_CSV_PARSE')
  assert.equal(result.errors[0]!.stage, 'ingest.parse')
})

test('모든 오류와 경고는 StageError 형식이다 (stage, code, message, hint)', () => {
  captureLogs()
  const result = ingestSalesCsv(fixture('synthetic_bad_date.csv'), MAPPING)
  for (const item of [...result.errors, ...result.warnings]) {
    assert.equal(typeof item.stage, 'string')
    assert.match(item.code, /^[EWI]_[A-Z_]+$/)
    assert.ok(item.message.length > 0)
    assert.ok(item.hint.length > 0)
  }
})

test('같은 입력이면 같은 결과가 나온다 (재현성)', () => {
  captureLogs()
  const a = ingestSalesCsv(fixture('synthetic_valid.csv'), MAPPING)
  const b = ingestSalesCsv(fixture('synthetic_valid.csv'), MAPPING)
  assert.deepEqual(a, b)
})

test('로그: 실패 단계와 코드가 기록되고, 매출 금액은 기록되지 않는다', () => {
  const lines = captureLogs()
  ingestSalesCsv(fixture('synthetic_bad_date.csv'), MAPPING)
  const errorLine = lines.map((l) => JSON.parse(l)).find((r) => r.event === 'error' && r.code === 'E_BAD_DATE')
  assert.ok(errorLine, '오류 로그 줄이 있어야 합니다')
  assert.equal(errorLine.stage, 'ingest.validate')
  assert.equal(errorLine.runId, 'test-run')
  const allText = lines.join('\n')
  assert.ok(!allText.includes('2500000'), '이상치 매출 금액이 로그에 나오면 안 됩니다')
})
