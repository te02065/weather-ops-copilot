/**
 * 이 파일이 하는 일: analysis/menuCriteria.ts 테스트 (메뉴별 ①③, 민감도 등급, 미확정 처리).
 * 입력: 작은 메뉴 일 매출과 특징 행
 * 출력: 테스트 통과/실패
 * 주의점: 비교할 날이 8일보다 적으면 등급은 '미확정'입니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { menuCriteria } from '../../analysis/menuCriteria'
import type { MenuDaily } from '../../analysis/posReport'
import type { FeatureRow } from '../../analysis/types'

function feat(date: string, rainBand: FeatureRow['rainBand']): FeatureRow {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return { date, y: 1000, dow, isHoliday: false, isClosed: false, isPromo: false, rainBand, tempAvg: 10, tempMax: null, tempMin: null, trendIdx: 0, weatherSource: 'observed', flags: [] }
}

test('메뉴 민감도: 비 오는 날 평균이 전체 평균보다 크게 다르면 높음, 날 수가 적으면 미확정', () => {
  const features: FeatureRow[] = []
  const menu: MenuDaily[] = []
  for (let i = 1; i <= 10; i++) {
    const date = `2026-01-${String(i).padStart(2, '0')}`
    features.push(feat(date, i <= 5 ? 'none' : 'heavy'))
    menu.push({ date, posCategory: 'COFFEE', menu: '아메리카노', menuKey: 'americano', qty: 1, amount: i <= 5 ? 100 : 40 })
  }
  const r = menuCriteria(menu, features, '2026-01-10', '2026-01-11', ['heavy'])
  const a = r.find((x) => x.name === '아메리카노')!
  assert.equal(a.sameWeather, 40)
  assert.equal(a.sensitivity, '미확정') // 강한 비 날이 5일뿐
  // 모든 날이 같은 날씨면 날씨에 따른 차이가 0 → 낮음
  const same = menuCriteria(menu, features.map((f) => ({ ...f, rainBand: 'none' as const })), '2026-01-10', '2026-01-11', ['none'])
  assert.equal(same.find((x) => x.name === '아메리카노')!.sensitivity, '낮음')
})
