/**
 * 이 파일이 하는 일: AI가 쓴 브리핑을 검사해서 쓸지, 고정 문장으로 바꿀지 정합니다 (설계 F12).
 * 입력: AI 응답 문장(없으면 null), BriefingFacts
 * 출력: { source: 'llm' | 'template', text, bad } — bad는 허용되지 않은 숫자 목록
 * 주의점: 숫자 검사나 금지 문장 검사를 통과하지 못하면 AI 문장을 버리고 계산 결과 문장(template)을 씁니다.
 *         AI가 실패했을 때는 데모 문장을 쓰지 않습니다. 계산 결과 문장을 쓰고 source를 'template'로 표시합니다.
 *         검사 결과 코드(통과/실패)만 로그에 남기고, 문장 내용은 남기지 않습니다.
 *         모든 브리핑 끝에 고정 문구(참고용, 검증 중)를 붙입니다.
 */

import { forbiddenIn, FIXED_FOOTER } from '../analysis/weeklyBriefing'
import { checkNumbers } from './numberCheck'
import { templateBriefing } from './template'
import type { BriefingFacts } from './facts'

export interface GuardResult {
  source: 'llm' | 'template'
  text: string
  bad: number[]
}

export function guardBriefing(llmText: string | null, facts: BriefingFacts): GuardResult {
  if (llmText === null || llmText.trim() === '') {
    return { source: 'template', text: withFooter(templateBriefing(facts)), bad: [] }
  }
  if (forbiddenIn(llmText).length > 0) {
    return { source: 'template', text: withFooter(templateBriefing(facts)), bad: [] }
  }
  const check = checkNumbers(llmText, facts)
  if (check.ok) return { source: 'llm', text: withFooter(llmText.trim()), bad: [] }
  return { source: 'template', text: withFooter(templateBriefing(facts)), bad: check.bad }
}

function withFooter(text: string): string {
  return text.includes(FIXED_FOOTER) ? text : `${text}\n${FIXED_FOOTER}`
}
