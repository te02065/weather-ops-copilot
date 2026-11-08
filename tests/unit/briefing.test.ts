/**
 * 이 파일이 하는 일: briefing/ 테스트 (허용 항목, 숫자 검사, 고정 문장 대체, 프롬프트).
 * 입력: 손으로 만든 facts (합성 값, 실제 매출 아님)
 * 출력: 테스트 통과/실패
 * 주의점: 임의의 숫자를 넣은 AI 응답이 템플릿으로 바뀌는지 확인합니다 (설계 §9 완료 기준).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { checkFactsAllowed, type BriefingFacts } from '../../briefing/facts'
import { checkNumbers, extractNumbers } from '../../briefing/numberCheck'
import { templateBriefing } from '../../briefing/template'
import { guardBriefing } from '../../briefing/guard'
import { buildBriefingMessages } from '../../briefing/prompt'

const FACTS: BriefingFacts = {
  storeCode: 'CAFE-A',
  targetDate: '2026-11-08',
  expectedSales: 80000,
  baselineSales: 100000,
  changeRatePct: -20,
  rainBand: 'light',
  tempAvg: 12.4,
  factors: [{ label: '약한 비가 온 날', effectPct: -18 }],
  recommendations: ['제조량 축소를 검토할 수 있습니다.'],
  status: 'ok',
  sampleSizes: { '학습한 날': 300, '약한 비가 온 날': 80 },
}

test('허용된 항목만 있으면 통과한다', () => {
  assert.equal(checkFactsAllowed(FACTS as unknown as Record<string, unknown>), null)
})

test('상호명이나 원본 행이 들어 있으면 E_FACT_FORBIDDEN', () => {
  const e = checkFactsAllowed({ ...FACTS, storeName: '오로밋' } as unknown as Record<string, unknown>)
  assert.equal(e?.code, 'E_FACT_FORBIDDEN')
  assert.ok(e!.message.includes('storeName'))
  const rows = checkFactsAllowed({ ...FACTS, rows: [] } as unknown as Record<string, unknown>)
  assert.ok(rows!.message.includes('rows'))
})

test('허용 목록에 없는 임의의 항목도 막는다', () => {
  const e = checkFactsAllowed({ ...FACTS, memo: '자유 입력' } as unknown as Record<string, unknown>)
  assert.equal(e?.code, 'E_FACT_FORBIDDEN')
})

test('숫자 검사: facts의 숫자와 반올림 변형은 통과한다', () => {
  const r = checkNumbers('예상 매출 80,000원, 기준선 100,000원, 변화 -20.0%입니다. 표본은 300일입니다.', FACTS)
  assert.equal(r.ok, true)
})

test('숫자 검사: facts에 없는 숫자는 차단한다', () => {
  const r = checkNumbers('예상 매출은 77,777원입니다.', FACTS)
  assert.equal(r.ok, false)
  assert.deepEqual(r.bad, [77777])
})

test('숫자 검사: 소수점 뒤 숫자까지 정확히 본다 (15.04는 15로 통과하지 않는다)', () => {
  assert.deepEqual(extractNumbers('변화 15.04%'), [15.04])
  assert.equal(checkNumbers('변화 15.04%', { ...FACTS, changeRatePct: 15 }).ok, false)
})

test('템플릿 문장은 자기 숫자 검사를 통과한다', () => {
  assert.equal(checkNumbers(templateBriefing(FACTS), FACTS).ok, true)
})

test('AI 문장에 임의의 숫자가 있으면 고정 문장(템플릿)으로 바꾼다', () => {
  const g = guardBriefing('이번 주 매출은 55,555원으로 예상됩니다.', FACTS)
  assert.equal(g.source, 'template')
  assert.ok(g.bad.includes(55555))
  assert.ok(g.text.includes('같은 요일 평균 매출'))
})

test('AI 문장의 숫자가 모두 맞으면 AI 문장을 그대로 쓴다', () => {
  const g = guardBriefing('예상 매출 80,000원입니다.', FACTS)
  assert.equal(g.source, 'llm')
})

test('AI 응답이 없으면 템플릿을 쓴다 (데모 문장 아님)', () => {
  const g = guardBriefing(null, FACTS)
  assert.equal(g.source, 'template')
  assert.equal(g.text, `${templateBriefing(FACTS)}
참고용 브리핑이에요. 정확도는 아직 검증 중이에요.`)
})

test('상태가 ok가 아니면 고정 문구를 템플릿에 넣는다', () => {
  const t = templateBriefing({ ...FACTS, status: 'forecast_unavailable', expectedSales: null, changeRatePct: null })
  assert.ok(t.includes('이 날짜는 날씨 예보 없이 기준선으로만 계산했습니다.'))
})

test('프롬프트에는 허용된 facts만 들어가고 상호명은 없다', () => {
  const m = buildBriefingMessages(FACTS)
  assert.ok(m.user.includes('CAFE-A'))
  assert.ok(!m.user.includes('오로밋'))
  assert.ok(m.system.includes('값만 사용'))
})

test('지시문: 금액은 만 원 단위로 쓰라고 안내한다', () => {
  assert.ok(buildBriefingMessages(FACTS).system.includes('만 원'))
})
