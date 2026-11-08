/**
 * 이 파일이 하는 일: analysis/posReport.ts 테스트 (POS 리포트 해석: 일별 결제금액, 메뉴, 제외 줄, 대조).
 * 입력: tests/fixtures/synthetic/synthetic_pos_report.xlsx (합성 파일, 실제 구조와 같은 종류의 함정 포함)
 * 출력: 테스트 통과/실패
 * 주의점: 합성 파일에는 옵션 2종, 진동벨, 배달료, 띄어쓰기·대소문자가 다른 같은 메뉴, 빈 카테고리가 들어 있습니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readXlsx } from '../../analysis/xlsx'
import { parsePosReport } from '../../analysis/posReport'
import { baseMenuName, lineKind, menuKey, posCategoryKey } from '../../analysis/posRules'

const load = async () => parsePosReport(await readXlsx(new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', 'synthetic_pos_report.xlsx')))))

test('기간과 일 수: 2026-01-01 ~ 03-01, 60일', async () => {
  const r = await load()
  assert.deepEqual(r.period, { start: '2026-01-01', end: '2026-03-01' })
  assert.equal(r.daily.length, 60)
})

test('일별 결제금액은 결제 합계 시트의 금액 그대로 (순매출)', async () => {
  const r = await load()
  assert.ok(r.daily.every((d) => d.netSales > 0))
})

test('줄 종류: 옵션, 진동벨 번호, 배달료는 메뉴가 아님', () => {
  assert.equal(lineKind('샷추가', ''), 'option')
  assert.equal(lineKind('7', '진동벨'), 'bell')
  assert.equal(lineKind('배달료', ''), 'delivery_fee')
  assert.equal(lineKind('아샷추', 'COFFEE'), 'menu')
})

test('메뉴 이름 키: 띄어쓰기와 대소문자 차이를 같은 메뉴로 봄', () => {
  assert.equal(menuKey('말차라떼 (ice)'), menuKey('말차라떼(ICE)'))
  assert.equal(posCategoryKey(''), '(미분류)')
  assert.equal(posCategoryKey('Smoothie'), posCategoryKey('SMOOTHIE'))
})

test('메뉴 합계: 같은 날·같은 카테고리·같은 메뉴는 한 줄로 합침, 제외 줄은 빠짐', async () => {
  const r = await load()
  const menuKeys = new Set(r.menuDaily.map((m) => m.menuKey))
  assert.equal(menuKeys.size, 6) // 아메리카노(ice)와 (hot)은 한 메뉴
  const tea = r.menuDaily.filter((m) => m.date === '2026-01-01' && m.menuKey === menuKey('말차라떼(ice)'))
  assert.equal(tea.length, 1)
  assert.ok(!r.menuDaily.some((m) => ['샷추가', '연하게', '배달료'].includes(m.menuKey)))
})

test('제외 집계: 옵션 2종 × 60일, 진동벨 60, 배달료 60줄 (금액 합 36만 원)', async () => {
  const r = await load()
  const byKind = Object.fromEntries(r.excluded.map((e) => [e.kind, e]))
  assert.equal(byKind.option!.rows, 120)
  assert.equal(byKind.bell!.rows, 60)
  assert.equal(byKind.delivery_fee!.rows, 60)
  assert.equal(byKind.delivery_fee!.amount, 360000)
})

test('대조: 메뉴 금액 + 배달료 = 결제금액 (60일 모두 일치)', async () => {
  const r = await load()
  assert.deepEqual(r.reconcile, { days: 60, matchedDays: 60, ignoredDays: 0, ignoredGap: 0 })
  assert.deepEqual(r.warnings, [])
})

test('수량·차수·공지 문구는 같은 메뉴 이름으로 본다', () => {
  assert.equal(baseMenuName('두바이 쫀득쿠키 (2개)'), '두바이 쫀득쿠키')
  assert.equal(baseMenuName('두바이 쫀득쿠키 (1개)'), '두바이 쫀득쿠키')
  assert.equal(baseMenuName('New) 두바이 쫀득쿠키 / 11시에 나와요 (2개)'), '두바이 쫀득쿠키')
  assert.equal(baseMenuName('두바이 쫀득쿠키 (2차) (2개)'), '두바이 쫀득쿠키')
  assert.equal(baseMenuName('두바이 쫀득쿠키 3차 (2개)'), '두바이 쫀득쿠키')
  assert.equal(menuKey('두바이 쫀득쿠키 (2개)'), menuKey('두바이쫀득쿠키'))
  assert.equal(baseMenuName('아메리카노(ice)'), '아메리카노')
})

test('T/O는 메뉴가 아닌 0원 표시로 제외한다', () => {
  assert.equal(lineKind('T/O', ''), 'service')
})

test('공지 시각과 차수가 붙은 변형도 같은 메뉴로 본다', () => {
  const key = menuKey('두바이쫀득쿠키')
  for (const v of ['두바이 쫀득쿠키 11시 (2개)', '두바이 쫀득쿠키 10시 30분에 나와요 (2개)', '두바이 쫀득쿠키 (2차) (2개)', 'New) 두바이 쫀득쿠키 / 2시50분에나와용 (2개)', '두바이 쫀득쿠키 3차']) {
    assert.equal(menuKey(v), key, v)
  }
  assert.equal(baseMenuName('아메리카노(ice)'), '아메리카노')
})
