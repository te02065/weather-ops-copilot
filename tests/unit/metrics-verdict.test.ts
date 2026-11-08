/**
 * 이 파일이 하는 일: analysis/metrics.ts, bootstrap.ts, verdict.ts 테스트.
 * 입력: 손으로 계산하기 쉬운 작은 숫자들
 * 출력: 테스트 통과/실패
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from '../../analysis/metrics'
import { blockBootstrapMean } from '../../analysis/bootstrap'
import { decideVerdict, verdictSentence } from '../../analysis/verdict'

test('MAE, WAPE, Bias 손 계산: 실제 [100, 200], 예측 [110, 180]', () => {
  // 오차 -10, +20 → MAE = 15, WAPE = 30/300 = 0.1, Bias = (+10/2) / 150 = 0.0333...
  const m = computeMetrics([{ actual: 100, pred: 110, base: null }, { actual: 200, pred: 180, base: null }])
  assert.equal(m.n, 2)
  assert.equal(m.mae, 15)
  assert.ok(Math.abs((m.wape as number) - 0.1) < 1e-12)
  assert.ok(Math.abs((m.bias as number) - (10 / 2) / 150) < 1e-12)
})

test('실제 매출 합이 0이면 WAPE를 계산하지 않고 zeroSum으로 표시한다', () => {
  const m = computeMetrics([{ actual: 0, pred: 5, base: null }])
  assert.equal(m.wape, null)
  assert.equal(m.zeroSum, true)
})

test('예측이 없는 날은 표본에서 뺀다. 표본이 없으면 값은 null', () => {
  assert.equal(computeMetrics([{ actual: 100, pred: null, base: null }]).n, 0)
  assert.equal(computeMetrics([{ actual: 100, pred: null, base: null }]).mae, null)
})

test('방향 정확도: ±2% 이내 실제 변화는 "변화 없음"으로 본다', () => {
  // 기준 100. 실제 101(+1%, 변화 없음), 예측 99(내림) → 불일치
  // 실제 110(+10%, 올림), 예측 120(올림) → 일치
  const m = computeMetrics([
    { actual: 101, pred: 99, base: 100 },
    { actual: 110, pred: 120, base: 100 },
  ])
  assert.equal(m.directionAcc, 0.5)
})

test('블록 부트스트랩: 같은 입력과 시드면 같은 결과', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  assert.deepEqual(blockBootstrapMean(values), blockBootstrapMean(values))
})

test('블록 부트스트랩: 평균은 맞고, 구간은 평균을 감싼다', () => {
  const values = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1 : -1))
  const r = blockBootstrapMean(values)!
  assert.ok(Math.abs(r.mean) < 1e-12)
  assert.ok(r.lower <= r.mean && r.mean <= r.upper)
})

test('블록 부트스트랩: 값이 모두 같으면 구간도 그 값 하나다', () => {
  const r = blockBootstrapMean([2, 2, 2, 2, 2, 2, 2, 2])!
  assert.equal(r.lower, 2)
  assert.equal(r.upper, 2)
})

test('판정 규칙: 점추정 음수이고 구간 상한도 음수면 adopt', () => {
  assert.equal(decideVerdict(-5, -1), 'adopt')
})

test('판정 규칙: 점추정은 음수지만 구간이 0을 포함하면 hold', () => {
  assert.equal(decideVerdict(-5, 2), 'hold')
})

test('판정 규칙: 점추정이 0 이상이면 reject', () => {
  assert.equal(decideVerdict(0, -1), 'reject')
  assert.equal(decideVerdict(3, 10), 'reject')
})

test('판정 문장은 방법론 §9.4 표현과 같다', () => {
  assert.equal(verdictSentence('reject'), '날씨 모델은 기준선을 넘지 못했다.')
})
