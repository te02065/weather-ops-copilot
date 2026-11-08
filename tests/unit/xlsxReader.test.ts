/**
 * 이 파일이 하는 일: analysis/xlsx.ts 테스트 (엑셀 파일을 시트별 표로 읽기).
 * 입력: tests/fixtures/synthetic/synthetic_pos_report.xlsx (합성, 실제 POS 구조를 흉내 낸 파일)
 * 출력: 테스트 통과/실패
 * 주의점: 줄바꿈이 든 열 이름, 숫자 글자, 끝의 빈 칸 생략을 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readXlsx } from '../../analysis/xlsx'

const bytes = () => new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', 'synthetic_pos_report.xlsx')))

test('시트 이름과 순서를 읽는다', async () => {
  const sheets = await readXlsx(bytes())
  assert.deepEqual(Object.keys(sheets), ['데이터 기준', '결제 합계', '상품 주문 합계'])
})

test('결제 합계: 두 줄 머리글, 숫자는 글자로 읽고 빈 칸은 null', async () => {
  const sheets = await readXlsx(bytes())
  const pay = sheets['결제 합계']!
  assert.equal(pay[0]![4], '결제수단별')
  assert.equal(pay[1]![0], '기간')
  assert.equal(pay[2]![0], '2026-01-01')
  assert.match(pay[2]![1]!, /^\d+\.0$/)
  assert.equal(pay[2]![4], null)
})

test('상품 주문 합계: 줄바꿈이 든 열 이름과 끝 빈 칸 처리', async () => {
  const sheets = await readXlsx(bytes())
  const prod = sheets['상품 주문 합계']!
  assert.equal(prod[0]![8], '실 판매 금액\n(할인, 옵션 포함)')
  assert.equal(prod[1]![0], '2026-01-01')
  assert.equal(prod[1]![1], '아메리카노(ice)')
})
