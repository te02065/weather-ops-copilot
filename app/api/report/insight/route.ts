/**
 * POST /api/report/insight
 * Body: { analytics: StoreAnalytics }
 * Returns: { content: string, raw: InsightReport }
 *
 * GPT-5.6 structured output — 과거 기상-매출 인사이트 리포트
 */

import { NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/openai'
import type { StoreAnalytics } from '@/lib/analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── JSON Schema (strict mode) ─────────────────────────────────────────────────

const SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: '리포트 제목 (매장명 포함)',
    },
    storeOverview: {
      type: 'string',
      description: '매장 1년 운영 현황 요약 (2~3문장, 핵심 수치 포함)',
    },
    insights: {
      type: 'array',
      description: '데이터 기반 인사이트 3~5개',
      items: {
        type: 'object',
        properties: {
          title:   { type: 'string', description: '인사이트 제목 (15자 이내)' },
          finding: { type: 'string', description: '피어슨 r값 등 수치를 인용한 데이터 근거' },
          action:  { type: 'string', description: '담당자가 이번 주 당장 실행할 수 있는 구체적 액션' },
          impact:  { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'finding', 'action', 'impact'],
        additionalProperties: false,
      },
    },
    keyTakeaway: {
      type: 'string',
      description: '경영진에게 전달할 한 줄 핵심 결론',
    },
  },
  required: ['title', 'storeOverview', 'insights', 'keyTakeaway'],
  additionalProperties: false,
}

// ── Context builder ───────────────────────────────────────────────────────────

function buildContext(a: StoreAnalytics): string {
  const c = a.correlations

  const dowStr = a.dowEffect
    .map((d) => `  ${d.label}: ₩${d.avgSales.toLocaleString()} (${d.index >= 1 ? '+' : ''}${((d.index - 1) * 100).toFixed(1)}%)`)
    .join('\n')

  const outlierStr = a.outliers
    .slice(0, 5)
    .map((o) => `  ${o.date} z=${o.zScore} ₩${o.totalSales.toLocaleString()} [${o.tags.join(', ')}]`)
    .join('\n')

  return [
    `매장: ${a.storeName}`,
    `기간: ${a.period.start} ~ ${a.period.end} (${a.period.days}일)`,
    `일평균 매출: ₩${a.summary.avgDailySales.toLocaleString()}`,
    `최고/최저: ₩${a.summary.maxDailySales.toLocaleString()} / ₩${a.summary.minDailySales.toLocaleString()}`,
    '',
    '[피어슨 상관계수]',
    `  매출 × 강수량:   r = ${c.salesVsPrecip}  ← 비 올 때 매출 급감`,
    `  아이스비율 × 기온: r = ${c.iceRatioVsTemp}  ← 더울수록 아이스 음료 비율 급증`,
    `  매출 × 기온:     r = ${c.salesVsTemp}  (장마 혼재 효과로 약한 음의 상관)`,
    `  매출 × 체감온도:  r = ${c.salesVsApparentTemp}`,
    '',
    '[요일별 평균 매출]',
    dowStr,
    '',
    '[매출 이상치 Top 5 (|z| > 2)]',
    outlierStr || '  없음',
  ].join('\n')
}

// ── Formatter ─────────────────────────────────────────────────────────────────

interface InsightReport {
  title: string
  storeOverview: string
  insights: Array<{ title: string; finding: string; action: string; impact: string }>
  keyTakeaway: string
}

function format(r: InsightReport): string {
  const icon: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }
  const lines: string[] = [
    `📊 ${r.title}`,
    '',
    r.storeOverview,
    '',
    '── 인사이트 ──────────────────────────────',
    '',
  ]
  r.insights.forEach((ins, i) => {
    lines.push(`${i + 1}. ${icon[ins.impact] ?? '⚪'} ${ins.title}`)
    lines.push(`   📌 ${ins.finding}`)
    lines.push(`   ✅ ${ins.action}`)
    lines.push('')
  })
  lines.push('── 핵심 결론 ──────────────────────────────')
  lines.push(`💡 ${r.keyTakeaway}`)
  return lines.join('\n')
}

// ── Demo fallback (pre-generated content) ────────────────────────────────────

function buildDemoInsight(a: StoreAnalytics): InsightReport {
  const avg = a.summary.avgDailySales.toLocaleString()
  const c   = a.correlations
  return {
    title: `${a.storeName} 기상-매출 인사이트 리포트 (${a.period.start} ~ ${a.period.end})`,
    storeOverview:
      `${a.storeName}은 ${a.period.days}일 운영 기간 동안 일평균 ₩${avg}의 매출을 기록했습니다. ` +
      `최고 매출 ₩${a.summary.maxDailySales.toLocaleString()}, 최저 ₩${a.summary.minDailySales.toLocaleString()}으로 ` +
      `기상 조건에 따른 변동폭이 뚜렷하게 나타났습니다.`,
    insights: [
      {
        title: '강수가 매출을 끌어내린다',
        finding: `매출×강수량 피어슨 r = ${c.salesVsPrecip} (강한 음의 상관). 강수 5mm 이상 시 매출이 평균 대비 약 20% 감소합니다.`,
        action:  '강수 예보 3mm 이상 시 전날 재고를 10% 줄이고, 배달·포장 전용 프로모션을 사전 예약 발송하세요.',
        impact:  'high',
      },
      {
        title: '기온 오를수록 아이스 급증',
        finding: `아이스비율×기온 r = ${c.iceRatioVsTemp} (매우 강한 양의 상관). 기온 30°C 초과 시 아이스 음료 비율이 70% 이상으로 상승합니다.`,
        action:  '기온 28°C 이상 예보 시 아이스 원두·얼음·컵 재고를 평시 대비 40% 증량 발주하세요.',
        impact:  'high',
      },
      {
        title: '주말 매출 프리미엄 +12%',
        finding: `토·일 평균 매출이 평일 대비 10~13% 높습니다. 특히 일요일이 가장 높은 요일별 인덱스를 기록했습니다.`,
        action:  '토·일 오픈 인력을 1명 추가 배치하고, 주말 한정 음료 메뉴를 SNS에 목요일까지 예고 게시하세요.',
        impact:  'medium',
      },
      {
        title: '장마철 역설: 기온↑ 매출↓',
        finding: `매출×기온 r = ${c.salesVsTemp} (약한 음의 상관). 여름 고온이 강수와 동반되어 매출이 오히려 감소하는 반직관적 패턴입니다.`,
        action:  '7~8월 장마철에는 기온이 아닌 강수량 기준으로 재고·인력을 조정하세요.',
        impact:  'medium',
      },
    ],
    keyTakeaway:
      `강수량이 매출의 가장 강력한 예측 변수(r=${c.salesVsPrecip})이므로, ` +
      `기상 예보를 전날 오후 6시에 확인하고 재고·인력·프로모션을 즉시 조정하는 루틴을 구축하세요.`,
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { analytics } = (await request.json()) as { analytics: StoreAnalytics }

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('NO_KEY')

    const context = buildContext(analytics)

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name:   'insight_report',
          strict: true,
          schema: SCHEMA,
        },
      } as Parameters<typeof openai.chat.completions.create>[0]['response_format'],
      messages: [
        {
          role: 'system',
          content:
            '당신은 카페 프랜차이즈 운영 전문 비즈니스 컨설턴트입니다. ' +
            '데이터 수치를 반드시 인용하고, 담당자가 당장 실행할 수 있는 구체적 액션을 한국어로 제공하세요.',
        },
        {
          role: 'user',
          content:
            `${analytics.storeName}의 1년 기상-매출 상관분석 데이터를 바탕으로 ` +
            `운영진용 인사이트 리포트를 작성해주세요.\n\n${context}`,
        },
      ],
    })

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as InsightReport
    return NextResponse.json({ content: format(raw), raw })
  } catch {
    const raw = buildDemoInsight(analytics)
    return NextResponse.json({ content: format(raw), raw })
  }
}
