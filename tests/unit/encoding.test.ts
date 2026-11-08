/**
 * 이 파일이 하는 일: analysis/encoding.ts와 ingestSalesCsvBytes 테스트 (UTF-8, UTF-8 BOM, CP949 판별).
 * 입력: tests/fixtures/synthetic/synthetic_korean_*.csv (합성 데이터), 테스트 안의 작은 바이트 배열
 * 출력: 테스트 통과/실패
 * 주의점: CP949 픽스처는 PowerShell로 만들었습니다 (Node에는 CP949 인코더가 기본으로 없음).
 *         같은 내용을 CP949와 UTF-8 BOM으로 읽었을 때 결과가 같아야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeCsvBytes, isStructurallyCp949 } from '../../analysis/encoding'
import { ingestSalesCsvBytes } from '../../analysis/ingest'
import { configureLogger } from '../../analysis/logger'
import type { ColumnMapping } from '../../analysis/types'

const KOREAN_MAPPING: ColumnMapping = {
  date: '날짜',
  sales: '매출',
  transactions: '거래수',
  iceSales: '아이스매출',
  hotSales: '핫매출',
}

function fixtureBytes(name: string): Buffer {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', name))
}

test('UTF-8 바이트는 utf-8로 읽힌다', () => {
  const d = decodeCsvBytes(Buffer.from('날짜,매출\n2026-01-01,100\n', 'utf-8'))
  assert.ok(d.ok)
  assert.equal(d.encoding, 'utf-8')
  assert.ok(d.ok && d.text.startsWith('날짜,매출'))
})

test('UTF-8 BOM은 제거되고 utf-8-bom으로 표시된다', () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('date,sales\n', 'utf-8')])
  const d = decodeCsvBytes(bytes)
  assert.ok(d.ok)
  assert.equal(d.encoding, 'utf-8-bom')
  assert.ok(d.ok && d.text.startsWith('date,sales'))
})

test('CP949 파일은 windows-949로 읽힌다', () => {
  const d = decodeCsvBytes(fixtureBytes('synthetic_korean_cp949.csv'))
  assert.ok(d.ok)
  assert.equal(d.encoding, 'windows-949')
  assert.ok(d.ok && d.text.startsWith('날짜,매출,거래수'))
})

test('같은 내용을 CP949와 UTF-8 BOM으로 읽으면 글자가 같다', () => {
  const cp = decodeCsvBytes(fixtureBytes('synthetic_korean_cp949.csv'))
  const u8 = decodeCsvBytes(fixtureBytes('synthetic_korean_utf8_bom.csv'))
  assert.ok(cp.ok && u8.ok)
  assert.equal(cp.text, u8.text)
})

test('UTF-8도 CP949도 아닌 바이트는 ok: false (E_CSV_PARSE 대상)', () => {
  assert.equal(decodeCsvBytes(Buffer.from([0x81])).ok, false)
  assert.equal(decodeCsvBytes(Buffer.from([0x81, 0x20])).ok, false)
})

test('CP949 구조 검사: 짝이 맞는 두 바이트는 통과, 뒤 바이트가 없으면 실패', () => {
  assert.equal(isStructurallyCp949(Buffer.from([0xb3, 0xaf])), true) // '날' 한 글자
  assert.equal(isStructurallyCp949(Buffer.from([0xb3])), false)
  assert.equal(isStructurallyCp949(Buffer.from([0x80])), false)
})

test('CP949 파일과 UTF-8 BOM 파일은 분석 결과가 같다 (인코딩 정보만 다름)', () => {
  configureLogger({ runId: 'enc-test', sink: () => {} })
  const cp = ingestSalesCsvBytes(fixtureBytes('synthetic_korean_cp949.csv'), KOREAN_MAPPING)
  const u8 = ingestSalesCsvBytes(fixtureBytes('synthetic_korean_utf8_bom.csv'), KOREAN_MAPPING)
  assert.equal(cp.ok, true)
  assert.deepEqual(cp.rows, u8.rows)
  assert.deepEqual(cp.summary, u8.summary)
  const codes = (r: typeof cp) => r.warnings.map((w) => w.code)
  assert.deepEqual(codes(cp), codes(u8))
  const enc = cp.warnings.find((w) => w.code === 'I_ENCODING')
  assert.ok(enc && enc.message.includes('windows-949'))
})

test('읽을 수 없는 바이트면 E_CSV_PARSE이고 단계는 ingest.parse이다', () => {
  configureLogger({ runId: 'enc-test', sink: () => {} })
  const result = ingestSalesCsvBytes(Buffer.from([0x81]), KOREAN_MAPPING)
  assert.equal(result.ok, false)
  assert.equal(result.errors[0]!.code, 'E_CSV_PARSE')
  assert.equal(result.errors[0]!.stage, 'ingest.parse')
})
