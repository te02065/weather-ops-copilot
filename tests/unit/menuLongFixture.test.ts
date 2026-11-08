/**
 * 이 파일이 하는 일: 메뉴별 합성 파일(synthetic_menu_long.csv)이 메뉴 형식 인식과 카테고리 합계를 통과하는지 확인합니다.
 * 입력: tests/fixtures/synthetic/synthetic_menu_long.csv (합성 데이터)
 * 출력: 테스트 통과/실패
 * 주의점: 기대값은 파일을 다시 읽어 직접 더해서 구합니다. 빈 금액 한 칸은 건너뛰고 개수로 세야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { classifyMenu, detectMenuFormat, sumLong, type LongRow } from '../../analysis/menuCategory'

const text = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', 'synthetic_menu_long.csv'), 'utf-8')
const [header, ...body] = text.trim().split('\n')
const rows: LongRow[] = body.map((line) => {
  const [date, menu, amount] = line.split(',')
  return { date: date!, menu: menu!, amount: amount === '' ? null : Number(amount) }
})

test('형식 인식: 날짜, 메뉴명, 금액 열이 있으면 길게 형식', () => {
  assert.deepEqual(detectMenuFormat(header!.split(',')), { kind: 'long', dateCol: '날짜', menuCol: '메뉴명', amountCol: '금액' })
})

test('합계: 날짜별 카테고리 합계가 파일을 직접 더한 값과 같고, 빈 금액 한 칸은 건너뛴다', () => {
  const { totals, skipped } = sumLong(rows)
  assert.equal(skipped, 1)
  const expected: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    if (r.amount === null) continue
    const cat = classifyMenu(r.menu)
    expected[r.date] ??= {}
    expected[r.date]![cat] = (expected[r.date]![cat] ?? 0) + r.amount
  }
  for (const date of Object.keys(expected)) {
    for (const [cat, value] of Object.entries(expected[date]!)) {
      assert.equal(totals[date]![cat as keyof (typeof totals)[string]], value, `${date} ${cat}`)
    }
  }
  assert.equal(Object.keys(totals).length, 60)
})

test('카테고리: 아이스 아메리카노와 에이드는 아이스 음료, 치즈 케이크는 디저트', () => {
  assert.equal(classifyMenu('아이스 아메리카노'), '아이스 음료')
  assert.equal(classifyMenu('에이드 자몽'), '아이스 음료')
  assert.equal(classifyMenu('핫 라떼'), '핫 음료')
  assert.equal(classifyMenu('치즈 케이크'), '디저트·베이커리')
})
