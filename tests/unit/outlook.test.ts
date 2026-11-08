/**
 * 이 파일이 하는 일: analysis/outlook.ts 테스트 (방향 나누기, 만 원 반올림, 근거 문장).
 * 입력: 변화율, 금액, 효과 목록
 * 출력: 테스트 통과/실패
 * 주의점: 경계값(±3%)은 "비슷함"입니다. 근거 문장에는 정확한 금액을 넣지 않습니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { directionOf, reasonFromParts, rainPart, roundToManWon, tempPart, weekdayPart } from '../../analysis/outlook'

test('방향: 기준선 대비 ±3% 안은 비슷함, 밖은 많이 또는 적게', () => {
  assert.equal(directionOf(0), 'similar')
  assert.equal(directionOf(3), 'similar')
  assert.equal(directionOf(-3), 'similar')
  assert.equal(directionOf(3.1), 'more')
  assert.equal(directionOf(-12), 'less')
})

test('범위는 만 원 단위로 반올림한다', () => {
  assert.equal(roundToManWon(554214), 550000)
  assert.equal(roundToManWon(556000), 560000)
})

test('근거: 강한 비 효과 문장, 정수 퍼센트, 금액 없음', () => {
  const text = reasonFromParts([rainPart({ name: 'rain_heavy', effectPct: -39.6, sampleSize: 37 })])
  assert.equal(text, '강한 비가 온 날은 평소보다 약 40% 적게 팔린 경향 (37일 기록)')
  assert.ok(!/₩|원/.test(text))
})

test('근거: 기온은 같은 달 평균과의 차이로 말한다 (14℃ 추우면 약 25% 적음)', () => {
  const p = tempPart(0.0202, 3.3, 17.6)
  assert.equal(p.text, '같은 달 평균(18℃)보다 14℃ 추워서 매출이 약 25% 적었던 경향')
})

test('근거: 요일은 일요일과 비교 (토요일 약 11% 많음)', () => {
  assert.equal(weekdayPart(0.1052, 6).text, '토요일은 일요일보다 약 11% 많이 팔리는 요일')
})

test('근거: 작은 요인은 말하지 않고, 큰 요인 두 개만 잇는다', () => {
  const text = reasonFromParts([
    { pct: -2, text: '작음' },
    { pct: -25, text: '추움' },
    { pct: 11, text: '토요일' },
    { pct: -18, text: '비' },
  ])
  assert.equal(text, '추움 · 비')
  assert.equal(reasonFromParts([{ pct: 1, text: 'x' }]), '요일과 최근 흐름을 기준으로 봤어요')
})
