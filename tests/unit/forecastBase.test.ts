/**
 * 이 파일이 하는 일: weather/forecastBase.ts 테스트 (발표 시각 고르기, 목표일 예보 시각 목록).
 * 입력: KST 기준 시각 (UTC 밀리초로 바꿔서 넣음)
 * 출력: 테스트 통과/실패
 * 주의점: 발표 후 10분이 지나기 전에는 그 발표를 고르면 안 됩니다. 첫 발표 전에는 어제 23시를 고릅니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { baseForTarget, latestBase, targetHours } from '../../weather/forecastBase'

/** KST 날짜와 시각을 UTC 밀리초로. */
const kst = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600e3

test('발표 후 10분이 지났으면 그 발표를 쓴다', () => {
  assert.deepEqual(latestBase(kst(2026, 11, 5, 5, 10)), { baseDate: '20261105', baseTime: '0500' })
})

test('발표 10분 전에는 직전 발표를 쓴다', () => {
  assert.deepEqual(latestBase(kst(2026, 11, 5, 5, 9)), { baseDate: '20261105', baseTime: '0200' })
})

test('첫 발표(02시 10분) 전에는 어제 23시 발표를 쓴다', () => {
  assert.deepEqual(latestBase(kst(2026, 11, 5, 1, 0)), { baseDate: '20261104', baseTime: '2300' })
})

test('목표일 예보 시각은 0시부터 23시까지 24개', () => {
  const hours = targetHours('2026-11-05')
  assert.equal(hours.length, 24)
  assert.equal(hours[0], '202611050000')
  assert.equal(hours[23], '202611052300')
})

test('목표일 하루를 덮으려면 목표일 0시 전의 가장 최근 발표(전날 23시)를 쓴다', () => {
  assert.deepEqual(baseForTarget(kst(2026, 11, 5, 11, 0), '2026-11-05'), { baseDate: '20261104', baseTime: '2300' })
})

test('목표일이 미래여도 지금 받을 수 있는 발표보다 새로운 것은 쓰지 않는다', () => {
  assert.deepEqual(baseForTarget(kst(2026, 11, 4, 12, 0), '2026-11-06'), { baseDate: '20261104', baseTime: '1100' })
})
