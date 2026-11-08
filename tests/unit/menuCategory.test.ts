/**
 * 이 파일이 하는 일: analysis/menuCategory.ts 테스트 (카테고리 분류, 파일 형식 인식, 날짜×카테고리 합계).
 * 입력: 메뉴 이름, 열 이름 목록, 작은 표 예시
 * 출력: 테스트 통과/실패
 * 주의점: 매장 메뉴표가 기본 규칙보다 우선해야 합니다. 금액이 없는 줄은 합계에서 빼고 개수를 셉니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyMenu, detectMenuFormat, sumLong, sumWide } from '../../analysis/menuCategory'

test('카테고리 분류: 아이스·핫이 먼저, 그다음 디저트와 음료, 나머지는 기타', () => {
  assert.equal(classifyMenu('아이스 아메리카노'), '아이스 음료')
  assert.equal(classifyMenu('Iced Latte'), '아이스 음료')
  assert.equal(classifyMenu('핫 초코'), '핫 음료')
  assert.equal(classifyMenu('아메리카노'), '음료 (온도 미정)')
  assert.equal(classifyMenu('치즈 케이크'), '디저트·베이커리')
  assert.equal(classifyMenu('에이드 자몽'), '아이스 음료')
  assert.equal(classifyMenu('텀블러 세트'), '기타')
})

test('매장 메뉴표가 기본 규칙보다 우선한다', () => {
  assert.equal(classifyMenu('아이스 아메리카노', { '아이스 아메리카노': '기타' }), '기타')
})

test('파일 형식: 메뉴 열과 금액 열이 있으면 길게, 메뉴 열이 여러 개면 넓게', () => {
  assert.deepEqual(detectMenuFormat(['날짜', '메뉴명', '금액']), { kind: 'long', dateCol: '날짜', menuCol: '메뉴명', amountCol: '금액' })
  assert.deepEqual(detectMenuFormat(['date', '아이스 아메리카노', '핫 라떼', 'sales']), { kind: 'wide', dateCol: 'date', menuCols: ['아이스 아메리카노', '핫 라떼'] })
  assert.equal(detectMenuFormat(['영업일', '매출액']).kind, 'none')
})

test('길게 형식 합계: 같은 날 같은 카테고리끼리 더하고, 금액 없는 줄은 뺀다', () => {
  const { totals, skipped } = sumLong([
    { date: '2026-11-01', menu: '아이스 아메리카노', amount: 4000 },
    { date: '2026-11-01', menu: '에이드 자몽', amount: 5000 },
    { date: '2026-11-01', menu: '치즈 케이크', amount: 6000 },
    { date: '2026-11-01', menu: '핫 초코', amount: null },
  ])
  assert.equal(totals['2026-11-01']!['아이스 음료'], 9000)
  assert.equal(totals['2026-11-01']!['디저트·베이커리'], 6000)
  assert.equal(totals['2026-11-01']!['핫 음료'], 0)
  assert.equal(skipped, 1)
})

test('넓게 형식 합계: 메뉴 열을 카테고리로 묶고 쉼표 금액을 읽는다', () => {
  const totals = sumWide(
    [{ date: '2026-11-02', '아이스 아메리카노': '4,000', '핫 라떼': '', '치즈 케이크': '6000' }],
    'date',
    ['아이스 아메리카노', '핫 라떼', '치즈 케이크'],
  )
  assert.equal(totals['2026-11-02']!['아이스 음료'], 4000)
  assert.equal(totals['2026-11-02']!['디저트·베이커리'], 6000)
  assert.equal(totals['2026-11-02']!['핫 음료'], 0)
})
