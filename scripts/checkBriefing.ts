/**
 * 이 파일이 하는 일: 운영 브리핑 AI 문장을 점검합니다 (개발자가 손으로 실행, 실제 OpenAI 호출 3번).
 * 입력: 없음 (.env.local의 OPENAI_API_KEY, 합성 점검 입력 3종)
 * 출력: 입력 종류별 AI 호출 결과 상태(llm 또는 template), 사용 토큰, 소요 시간, 숫자 검사 결과, 문장
 * 주의점: 키 값은 출력하지 않습니다. 응답 길이는 max_completion_tokens로 제한합니다. 실제 매장 데이터는 쓰지 않습니다.
 *         사용법: npm run check-briefing
 */

import { existsSync } from 'fs'
import { buildBriefingMessages } from '../briefing/prompt'
import { guardBriefing } from '../briefing/guard'
import { checkFactsAllowed, type BriefingFacts } from '../briefing/facts'

// lib/openai는 모듈이 읽힐 때 환경 변수를 잡으므로, .env.local을 읽은 뒤에 불러옵니다.
type OpenAIModule = typeof import('../lib/openai')

const MAX_TOKENS = 2000

/** 점검 입력 3종: 비가 많이 온 날, 맑은 날, 데이터 부족 날 (모두 합성 값) */
const CASES: Array<{ name: string; facts: BriefingFacts }> = [
  {
    name: '비가 많이 온 날',
    facts: {
      storeCode: 'CHECK', targetDate: '2026-11-08', expectedSales: 380000, baselineSales: 560000, changeRatePct: -32,
      rainBand: 'heavy', tempAvg: 9, factors: [{ label: '강한 비가 온 날', effectPct: -40 }],
      recommendations: [], status: 'ok', sampleSizes: { '학습한 날': 300, '강한 비가 온 날': 37 },
    },
  },
  {
    name: '맑은 날',
    facts: {
      storeCode: 'CHECK', targetDate: '2026-11-09', expectedSales: 600000, baselineSales: 560000, changeRatePct: 7,
      rainBand: 'none', tempAvg: 16, factors: [{ label: '기온(1℃당)', effectPct: 2 }],
      recommendations: [], status: 'ok', sampleSizes: { '학습한 날': 300, '기온(1℃당)': 365 },
    },
  },
  {
    name: '데이터 부족 날',
    facts: {
      storeCode: 'CHECK', targetDate: '2026-11-10', expectedSales: null, baselineSales: 520000, changeRatePct: null,
      rainBand: null, tempAvg: null, factors: [], recommendations: [], status: 'forecast_unavailable',
      sampleSizes: { '학습한 날': 40 },
    },
  },
  {
    name: '날씨 예보와 세 기준이 있는 날',
    facts: {
      storeCode: 'CHECK', targetDate: '2026-11-14', expectedSales: 1190000, baselineSales: 1330000, changeRatePct: -11,
      rainBand: '비 가능성 60%', tempAvg: 6, factors: [], recommendations: [], status: 'ok',
      sampleSizes: { '학습한 날': 300, '요일 표본': 46 },
      weather: { sky: '흐림', tempMin: 4, tempMax: 9, precipMm: null, popPct: 60 },
      criteria: { sameWeekdayAvg: 1330000, sameWeekdayN: 46, lastYearSales: 590000, sameWeatherName: '비 올 확률 60%일 때 평균 매출', sameWeatherAvg: 680000, sameWeatherN: 16, sameWeatherRange: [670000, 690000] },
      outlookDirection: 'less', outlookReason: '같은 달 평균보다 8℃ 추워서 매출이 약 7% 적었던 경향', menuMovers: ['두바이 쫀득쿠키', '말차라떼'],
      week: { more: 0, less: 4, similar: 3, known: 7 },
    },
  },
]

async function main(): Promise<void> {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local')
  const { openai, MODEL }: OpenAIModule = await import('../lib/openai')
  if (!process.env.OPENAI_API_KEY) {
    console.log('✖ OPENAI_API_KEY가 .env.local에 없습니다. 키를 넣고 다시 실행하세요. (키 값은 출력하지 않습니다)')
    process.exit(1)
  }
  console.log(`모델: ${MODEL}, 응답 상한: ${MAX_TOKENS} 토큰`)
  for (const c of CASES) {
    const forbidden = checkFactsAllowed(c.facts as unknown as Record<string, unknown>)
    if (forbidden) { console.log(`✖ [${c.name}] 금지 항목: ${forbidden.message}`); continue }
    const started = Date.now()
    let llmText: string | null = null
    let llmStatus = 'error'
    let tokens = 0
    try {
      const m = buildBriefingMessages(c.facts)
      const res = await openai.chat.completions.create({
        model: MODEL,
        max_completion_tokens: MAX_TOKENS,
        messages: [{ role: 'system', content: m.system }, { role: 'user', content: m.user }],
      })
      llmText = res.choices[0]?.message?.content ?? null
      tokens = res.usage?.total_tokens ?? 0
      llmStatus = 'ok'
    } catch (err) {
      const status = (err as { status?: number }).status
      llmStatus = status ? `error_http_${status}` : 'error'
    }
    const guarded = guardBriefing(llmText, c.facts)
    console.log(`\n== ${c.name}`)
    console.log(`  호출: ${llmStatus}, 토큰 ${tokens}, ${Date.now() - started}ms`)
    console.log(`  결과 출처: ${guarded.source}, 숫자 검사 ${guarded.bad.length === 0 ? '통과' : `실패 (${guarded.bad.join(', ')})`}`)
    if (guarded.source === 'template' && llmText) console.log(`  AI 원문(검사에서 막힘): ${llmText.split('\n').join(' / ')}`)
    console.log(`  문장: ${guarded.text.replace(/\n/g, ' / ')}`)
  }
}

main().catch(() => {
  console.log('✖ 예상하지 못한 오류 (키는 출력하지 않습니다)')
  process.exit(1)
})
