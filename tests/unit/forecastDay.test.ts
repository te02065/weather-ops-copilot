/**
 * 이 파일이 하는 일: weather/forecastDay.ts 테스트 (시간별 값을 하루 값으로 묶기).
 * 입력: 0~23시 기온과 강수량 예시 (일부는 null)
 * 출력: 테스트 통과/실패
 * 주의점: 강수가 전부 비어 있으면 0이 아니라 null이어야 합니다 (정보가 없다는 뜻).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateDay } from '../../weather/forecastDay'

test('하루 강수량은 시간별 합, 기온은 평균·최고·최저', () => {
  const temps = [10, 12, null, 14]
  const precips = [0, 1.5, 2, null]
  const d = aggregateDay('2026-11-05', temps, precips)
  assert.equal(d.precipMm, 3.5)
  assert.equal(d.tempAvg, 12)
  assert.equal(d.tempMax, 14)
  assert.equal(d.tempMin, 10)
  assert.equal(d.windMs, null)
})

test('강수 값이 전부 없으면 강수량은 null (0이 아님)', () => {
  const d = aggregateDay('2026-11-05', [5, 6], [null, null])
  assert.equal(d.precipMm, null)
  assert.equal(d.tempAvg, 5.5)
})

test('기온이 전부 없으면 기온 값은 모두 null', () => {
  const d = aggregateDay('2026-11-05', [null], [0])
  assert.equal(d.tempAvg, null)
  assert.equal(d.tempMax, null)
  assert.equal(d.precipMm, 0)
})
