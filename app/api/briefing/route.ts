/**
 * POST /api/briefing
 * 이 파일이 하는 일: 허용된 facts만 받아 AI 브리핑을 만들고, 숫자 검사를 통과하지 못하면 계산 결과 문장으로 바꿉니다.
 * 입력: { facts: BriefingFacts } (허용 항목만)
 * 출력: { text, source: 'llm' | 'template', llmStatus, badNumbers }
 * 주의점: 금지 항목(상호명, 원본 행, 날짜별 목록 등)이 있으면 400으로 거절합니다.
 *         AI가 없거나 실패하면 데모 문장이 아니라 계산 결과 문장을 씁니다.
 *         AI 요청과 응답 내용은 로그에 남기지 않습니다. 호출 결과 상태만 남깁니다.
 */

import { NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/openai'
import { checkFactsAllowed, type BriefingFacts } from '@/briefing/facts'
import { buildBriefingMessages } from '@/briefing/prompt'
import { guardBriefing } from '@/briefing/guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { facts?: unknown } | null
  if (!body || typeof body.facts !== 'object' || body.facts === null) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: 'facts 항목이 필요합니다.' }, { status: 400 })
  }
  const forbidden = checkFactsAllowed(body.facts as Record<string, unknown>)
  if (forbidden) {
    return NextResponse.json({ code: forbidden.code, message: forbidden.message, hint: forbidden.hint }, { status: 400 })
  }
  const facts = body.facts as BriefingFacts

  let llmText: string | null = null
  let llmStatus: 'ok' | 'no_key' | 'error' = 'no_key'
  if (process.env.OPENAI_API_KEY) {
    const messages = buildBriefingMessages(facts)
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
      })
      llmText = completion.choices[0]?.message?.content ?? null
      llmStatus = 'ok'
    } catch {
      llmStatus = 'error' // 오류 내용은 남기지 않습니다 (키가 섞일 수 있음)
    }
  }
  const guarded = guardBriefing(llmText, facts)
  return NextResponse.json({ text: guarded.text, source: guarded.source, llmStatus, badNumbers: guarded.bad })
}
