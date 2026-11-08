/**
 * 이 파일이 하는 일: analysis/menuWeather.ts 테스트 (날씨 구간별 카테고리 평균 하루 매출).
 * 입력: 작은 메뉴 일 매출 목록과 특징 행
 * 출력: 테스트 통과/실패
 * 주의점: 표본이 최소 기준(8일)보다 적은 칸은 평균을 숨깁니다. 유효 영업일이 아닌 날은 빠집니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryByBand } from '../../analysis/menuWeather'
import type { MenuDaily } from '../../analysis/posReport'
import type { FeatureRow } from '../../analysis/types'

function feat(date: string, rainBand: FeatureRow['rainBand'], y: number): FeatureRow {
  return { date, y, dow: 1, isHoliday: false, isClosed: false, isPromo: false, rainBand, tempAvg: 10, tempMax: null, tempMin: null, trendIdx: 0, weatherSource: 'observed', flags: [] }
}

test('카테고리별 강수 구간 평균은 하루 합계의 평균이고, 표본 8일 미만은 숨긴다', () => {
  const features: FeatureRow[] = []
  const menu: MenuDaily[] = []
  for (let i = 1; i <= 10; i++) {
    const date = `2026-01-${String(i).padStart(2, '0')}`
    features.push(feat(date, 'none', 1000))
    menu.push({ date, posCategory: 'COFFEE', menu: 'a', menuKey: 'a', qty: 1, amount: 100 })
    menu.push({ date, posCategory: 'COFFEE', menu: 'b', menuKey: 'b', qty: 1, amount: 50 })
  }
  for (let i = 11; i <= 12; i++) {
    const date = `2026-01-${i}`
    features.push(feat(date, 'heavy', 1000))
    menu.push({ date, posCategory: 'COFFEE', menu: 'a', menuKey: 'a', qty: 1, amount: 100 })
  }
  const table = categoryByBand(menu, features, (m) => m.posCategory)
  assert.equal(table.COFFEE!.none.days, 10)
  assert.equal(table.COFFEE!.none.avgPerDay, 150)
  assert.equal(table.COFFEE!.heavy.days, 2)
  assert.equal(table.COFFEE!.heavy.avgPerDay, null)
  assert.equal(table.COFFEE!.light.avgPerDay, null)
})

test('유효 영업일이 아닌 날(매출 0)은 세지 않는다', () => {
  const features = [feat('2026-01-01', 'none', 0)]
  const menu: MenuDaily[] = [{ date: '2026-01-01', posCategory: 'TEA', menu: 't', menuKey: 't', qty: 1, amount: 500 }]
  const table = categoryByBand(menu, features, (m) => m.posCategory)
  assert.equal(table.TEA, undefined)
})
