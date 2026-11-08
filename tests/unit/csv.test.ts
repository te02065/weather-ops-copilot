/**
 * 이 파일이 하는 일: analysis/csv.ts 테스트 (CSV 읽기, 숫자 칸, 행 만들기, E_CSV_PARSE, E_BAD_DATE, E_BAD_NUMBER).
 * 입력: 작은 CSV 문자열 (테스트 안에 직접 적음, 합성 데이터)
 * 출력: 테스트 통과/실패
 * 주의점: 열 이름은 매핑으로만 정합니다. 자동 추정 테스트도 포함합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readCsvText, parseAmount, buildRows } from '../../analysis/csv'

test('숫자 칸: 쉼표는 허용하고, 빈 칸은 null(0이 아님)이다', () => {
  assert.deepEqual(parseAmount('1,234,000'), { value: 1234000, bad: false })
  assert.deepEqual(parseAmount(''), { value: null, bad: false })
  assert.deepEqual(parseAmount(undefined), { value: null, bad: false })
  assert.deepEqual(parseAmount('12abc'), { value: null, bad: true })
})

test('CSV 헤더와 레코드를 읽는다', () => {
  const read = readCsvText('date,sales\n2026-01-01,100\n')
  assert.deepEqual(read.fields, ['date', 'sales'])
  assert.equal(read.records.length, 1)
  assert.equal(read.errors.length, 0)
})

test('닫히지 않은 따옴표는 E_CSV_PARSE 오류가 된다 (stage는 ingest.parse)', () => {
  const read = readCsvText('date,sales\n"2026-01-01,100\n')
  assert.ok(read.errors.length > 0)
  assert.equal(read.errors[0]!.code, 'E_CSV_PARSE')
  assert.equal(read.errors[0]!.stage, 'ingest.parse')
})

test('데이터 행이 없으면 E_CSV_PARSE 오류가 된다', () => {
  const read = readCsvText('date,sales\n')
  assert.equal(read.errors[0]!.code, 'E_CSV_PARSE')
})

test('날짜가 틀리면 E_BAD_DATE, 행 번호와 열 이름이 메시지에 들어간다', () => {
  const read = readCsvText('date,sales\n2026-02-30,100\n2026-02-03,200\n')
  const built = buildRows(read.records, { date: 'date', sales: 'sales' })
  assert.equal(built.errors.length, 1)
  assert.equal(built.errors[0]!.code, 'E_BAD_DATE')
  assert.equal(built.errors[0]!.row, 2)
  assert.match(built.errors[0]!.message, /'date' 열\(파일 2번째 줄\)/)
  assert.equal(built.rows.length, 1) // 날짜가 틀린 행은 건너뜀
})

test('빈 줄이 있어도 줄 번호는 엑셀에서 보이는 번호와 같다', () => {
  const read = readCsvText('date,sales\n2026-01-01,1\n\n2026-01-03,2\n')
  assert.equal(read.errors.length, 0) // 빈 줄은 오류가 아닙니다
  const built = buildRows(read.records, { date: 'date', sales: 'sales' })
  assert.deepEqual(built.rows.map((r) => r.row), [2, 4]) // 3번째 줄은 빈 줄
})

test('헤더 앞에 빈 줄이 있어도 헤더를 올바로 읽고, 줄 번호는 실제 줄 기준이다', () => {
  const read = readCsvText('\r\ndate,sales\r\n2026-01-01,100\r\n')
  assert.deepEqual(read.fields, ['date', 'sales'])
  assert.equal(read.errors.length, 0)
  assert.equal(read.records[0]!.line, 3) // 1번째 줄 빈 줄, 2번째 줄 헤더, 3번째 줄 데이터
})

test('글자가 깨진 파일(U+FFFD)은 E_CSV_PARSE 오류가 된다', () => {
  const read = readCsvText('date,sales\n2026-01-01,1\u{FFFD}\n')
  assert.ok(read.errors.some((e) => e.code === 'E_CSV_PARSE' && /글자가 깨져/.test(e.message)))
})

test('숫자가 틀리면 E_BAD_NUMBER, 그 칸만 null이고 행은 남는다', () => {
  const read = readCsvText('date,sales\n2026-02-03,abc\n')
  const built = buildRows(read.records, { date: 'date', sales: 'sales' })
  assert.equal(built.errors[0]!.code, 'E_BAD_NUMBER')
  assert.equal(built.rows[0]!.sales, null)
})

test('매핑하지 않은 열은 읽지 않는다 (열 이름 자동 추정 없음)', () => {
  const read = readCsvText('날짜,매출,거래\n2026-02-03,300,5\n')
  const built = buildRows(read.records, { date: '날짜', sales: '매출' })
  assert.equal(built.rows[0]!.sales, 300)
  assert.equal(built.rows[0]!.transactions, null)
})
