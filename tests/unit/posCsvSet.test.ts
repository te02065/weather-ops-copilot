/**
 * 이 파일이 하는 일: 테스트용 합성 POS 파일 3종이 실제 업로드 경로(바이트 → 인코딩 → 열 매핑 → 검증)를 통과하는지 확인합니다.
 * 입력: tests/fixtures/synthetic/synthetic_pos_*.csv (모두 합성 데이터, 실제 매출 아님)
 * 출력: 테스트 통과/실패
 * 주의점: 파일 A는 CP949, 천 단위 쉼표, 선택 열 없음, 빈 줄을 씁니다. 파일 B는 UTF-8 BOM, 슬래시 날짜, 빈 줄을 씁니다.
 *         파일 C는 엑셀에서 보이는 날짜(2026. 1. 1.)와 엑셀 날짜 번호(46024)가 섞여 있습니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ingestSalesCsvBytes } from '../../analysis/ingest'
import type { ColumnMapping } from '../../analysis/types'

const DIR = join(process.cwd(), 'tests', 'fixtures', 'synthetic')
const load = (name: string) => new Uint8Array(readFileSync(join(DIR, name)))

test('파일 A (CP949, 쉼표 금액, 선택 열 없음, 빈 줄): 60일 모두 읽고 오류가 없다', () => {
  const mapping: ColumnMapping = { date: '영업일', sales: '매출액' }
  const r = ingestSalesCsvBytes(load('synthetic_pos_a_cp949.csv'), mapping)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(r.rows.length, 60)
  assert.equal(r.rows[0]!.date, '2026-01-01')
  assert.equal(r.rows[0]!.sales, 760000) // "760,000"으로 적힌 값을 숫자로 읽음
  assert.ok(r.warnings.some((w) => w.code === 'I_ENCODING'))
  assert.equal(r.summary.hasTransactions, false) // 선택 열을 고르지 않으면 조용히 빠집니다
  assert.ok(!r.warnings.some((w) => w.code === 'I_OPTIONAL_MISSING'))
})

test('파일 B (UTF-8 BOM, 슬래시 날짜, 빈 줄): 60일 모두 읽고 거래건수가 들어간다', () => {
  const mapping: ColumnMapping = { date: '날짜', sales: '매출', transactions: '거래건수' }
  const r = ingestSalesCsvBytes(load('synthetic_pos_b_utf8_bom.csv'), mapping)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(r.rows.length, 60)
  assert.equal(r.rows[0]!.date, '2026-01-01')
  assert.equal(r.rows[59]!.date, '2026-03-01')
  assert.equal(r.summary.hasTransactions, true)
})

test('파일 C (엑셀 표시 날짜와 날짜 번호가 섞임): 두 형식 모두 같은 날짜로 읽는다', () => {
  const mapping: ColumnMapping = { date: 'date', sales: 'sales', transactions: 'transactions', iceSales: 'ice_sales', hotSales: 'hot_sales' }
  const r = ingestSalesCsvBytes(load('synthetic_pos_c_excel_dates.csv'), mapping)
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(r.rows.length, 60)
  assert.equal(r.rows[0]!.date, '2026-01-01') // "2026. 1. 1."
  assert.equal(r.rows[1]!.date, '2026-01-02') // 46024
  assert.equal(r.rows[59]!.date, '2026-03-01')
})
