/**
 * 이 파일이 하는 일: AI 브리핑 검사(briefing/guard, numberCheck)와 고정 문구 테스트.
 * 입력: 작은 facts와 AI 문장 예시
 * 출력: 테스트 통과/실패
 * 주의점: 금지 문장이나 없는 숫자가 있으면 템플릿으로 바뀌고, 모든 결과에 고정 문구가 붙어야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { guardBriefing } from '../../briefing/guard'
import { checkNumbers } from '../../briefing/numberCheck'
import { FIXED_FOOTER } from '../../analysis/weeklyBriefing'
import type { BriefingFacts } from '../../briefing/facts'

const facts: BriefingFacts = {
  storeCode: 'CAFE-A', targetDate: '2026-11-14', expectedSales: 1190000, baselineSales: 1330000, changeRatePct: -11,
  rainBand: '비 가능성 60%', tempAvg: 6, factors: [], recommendations: [], status: 'ok', sampleSizes: { '학습한 날': 300 },
  weather: { sky: '흐림', tempMin: 4, tempMax: 9, precipMm: null, popPct: 60 },
  menuMovers: ['말차라떼'],
}

test('AI 문장이 facts 숫자만 쓰면 AI 문장을 쓰고 고정 문구를 붙인다', () => {
  const g = guardBriefing('오늘은 흐리고 최저 4℃, 최고 9℃예요. 말차라떼가 날씨에 따라 달라질 수 있어요.', facts)
  assert.equal(g.source, 'llm')
  assert.ok(g.text.endsWith(FIXED_FOOTER))
})

test('금지 문장이 있으면 템플릿으로 바꾼다', () => {
  const g = guardBriefing('이 예측은 정확하게 맞습니다. 최고 9℃예요.', facts)
  assert.equal(g.source, 'template')
  assert.match(g.text, /날씨 예보: 흐림/)
  assert.ok(g.text.endsWith(FIXED_FOOTER))
})

test('facts에 없는 숫자가 있으면 템플릿으로 바꾼다', () => {
  const g = guardBriefing('최고 35℃까지 올라갑니다.', facts)
  assert.equal(g.source, 'template')
  assert.deepEqual(g.bad, [35])
})

test('AI가 실패하면(null) 계산 결과 문장을 쓴다', () => {
  const g = guardBriefing(null, facts)
  assert.equal(g.source, 'template')
  assert.match(g.text, /최저 4℃, 최고 9℃/)
})

test('숫자 검사는 만 원 단위 반올림 표기를 허용한다', () => {
  assert.ok(checkNumbers('같은 요일 평균은 약 133만 원입니다.', facts).ok)
})
