/**
 * POST /api/report/briefing
 * Body: { analytics: StoreAnalytics, forecast: DailyPoint[] }
 * Returns: { content: string, raw: OperationalBriefing }
 *
 * GPT-5.6 structured output — 향후 7일 운영 브리핑 (매출예측 + 재고/인력/프로모션)
 */

import { NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/openai'
import type { StoreAnalytics } from '@/lib/analytics'
import type { DailyPoint } from '@/lib/weather'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── JSON Schema (strict mode) ─────────────────────────────────────────────────

const DAILY_ITEM = {
  type: 'object',
  properties: {
    date:               { type: 'string', description: 'YYYY-MM-DD' },
    dayLabel:           { type: 'string', description: '예: 7/21(월)' },
    weatherSummary:     { type: 'string', description: '날씨 한 줄 요약 (이모지 포함)' },
    expectedSales:      { type: 'number', description: '예상 일매출 (원, 정수)' },
    salesChangePercent: { type: 'number', description: '일평균 대비 변화율 (%, 소수점 1자리)' },
    inventoryAction:    { type: 'string', description: '재고 조정 지침 (구체적 품목·수량)' },
    staffingAction:     { type: 'string', description: '인력 배치 지침 (구체적 인원·시간대)' },
    promotionAction:    { type: 'string', description: '프로모션 제안. 없으면 "해당 없음"' },
  },
  required: [
    'date', 'dayLabel', 'weatherSummary', 'expectedSales',
    'salesChangePercent', 'inventoryAction', 'staffingAction', 'promotionAction',
  ],
  additionalProperties: false,
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: '브리핑 제목 (매장명 + 날짜 범위 포함)',
    },
    overallOutlook: {
      type: 'string',
      description: '주간 전체 날씨·매출 전망 (2~3문장, 구체적 수치 포함)',
    },
    dailyForecasts: {
      type: 'array',
      description: '7일 일별 예측 및 운영 지침',
      items: DAILY_ITEM,
    },
    weekSummary: {
      type: 'string',
      description: '주간 운영 핵심 요약 (재고·인력·프로모션 통합 가이드, 3~5문장)',
    },
    slackCard: {
      type: 'string',
      description: 'Slack 알림용 마크다운 메시지. *굵게*, ~취소선~, 이모지 적극 활용. 150자 이내 요약 후 일별 핵심만.',
    },
  },
  required: ['title', 'overallOutlook', 'dailyForecasts', 'weekSummary', 'slackCard'],
  additionalProperties: false,
}

// ── Context builder ───────────────────────────────────────────────────────────

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

function buildContext(a: StoreAnalytics, forecast: DailyPoint[]): string {
  const c = a.correlations

  const fcastStr = forecast
    .map((f) => {
      const dow = DOW_KR[new Date(f.date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6]
      const [, m, d] = f.date.split('-')
      return `  ${m}/${d}(${dow})  최고${f.tempMax}°C  체감${f.apparentTempMax}°C  강수${f.precip}mm`
    })
    .join('\n')

  return [
    `매장: ${a.storeName}`,
    `일평균 매출(기준): ₩${a.summary.avgDailySales.toLocaleString()}`,
    '',
    '[기상-매출 상관 규칙 (과거 1년 실측)]',
    `  강수 ≥ 5mm  → 매출 약 -20%  (r = ${c.salesVsPrecip})`,
    `  강수 2~5mm  → 매출 약  -8%`,
    `  기온 ≥ 30°C → 아이스 음료 비율 급증  (r = ${c.iceRatioVsTemp})`,
    `  주말(토/일) → 매출 평균 +12%`,
    '',
    '[향후 7일 기상 예보]',
    fcastStr,
  ].join('\n')
}

// ── Formatter ─────────────────────────────────────────────────────────────────

interface DailyForecast {
  date: string
  dayLabel: string
  weatherSummary: string
  expectedSales: number
  salesChangePercent: number
  inventoryAction: string
  staffingAction: string
  promotionAction: string
}

interface OperationalBriefing {
  title: string
  overallOutlook: string
  dailyForecasts: DailyForecast[]
  weekSummary: string
  slackCard: string
}

function format(b: OperationalBriefing): string {
  const lines: string[] = [
    `📅 ${b.title}`,
    '',
    b.overallOutlook,
    '',
    '── 일별 예측 ──────────────────────────────',
    '',
  ]

  b.dailyForecasts.forEach((d) => {
    const sign   = d.salesChangePercent >= 0 ? '+' : ''
    const bullet = d.salesChangePercent <= -10 ? '🔴' : d.salesChangePercent < 0 ? '🟡' : '🟢'
    lines.push(
      `${bullet} ${d.dayLabel}  ₩${d.expectedSales.toLocaleString()}  (${sign}${d.salesChangePercent.toFixed(1)}%)`,
    )
    lines.push(`   🌤️ ${d.weatherSummary}`)
    lines.push(`   📦 재고: ${d.inventoryAction}`)
    lines.push(`   👥 인력: ${d.staffingAction}`)
    if (d.promotionAction !== '해당 없음') {
      lines.push(`   🎯 프로모션: ${d.promotionAction}`)
    }
    lines.push('')
  })

  lines.push('── 주간 요약 ──────────────────────────────')
  lines.push(b.weekSummary)
  lines.push('')
  lines.push('── Slack 카드 ──────────────────────────────')
  lines.push(b.slackCard)

  return lines.join('\n')
}

// ── Demo fallback (pre-generated content) ────────────────────────────────────

function buildDemoBriefing(a: StoreAnalytics, forecast: DailyPoint[]): OperationalBriefing {
  const avg   = a.summary.avgDailySales
  const start = forecast[0]?.date ?? '2026-07-21'
  const end   = forecast[forecast.length - 1]?.date ?? '2026-07-27'

  const daily: DailyForecast[] = forecast.slice(0, 7).map((f) => {
    const dow   = DOW_KR[new Date(f.date).getDay() as 0|1|2|3|4|5|6]
    const [, m, d] = f.date.split('-')
    const label = `${m}/${d}(${dow})`
    const isWeekend  = dow === '토' || dow === '일'
    const heavyRain  = f.precip >= 5
    const lightRain  = f.precip >= 2 && f.precip < 5
    const hotDay     = f.tempMax >= 30

    let changePct = 0
    if (heavyRain)  changePct -= 20
    else if (lightRain) changePct -= 8
    if (isWeekend)  changePct += 12
    changePct = Math.round(changePct * 10) / 10

    const expected = Math.round(avg * (1 + changePct / 100) / 1000) * 1000

    let weatherSummary = `최고 ${f.tempMax}°C`
    if (heavyRain)  weatherSummary += `, 강한 비 ${f.precip}mm ☔ 외출 자제`
    else if (lightRain) weatherSummary += `, 약한 비 ${f.precip}mm 🌧`
    else if (hotDay)    weatherSummary += `, 폭염 주의 ☀️`
    else weatherSummary += `, 맑음 🌤`

    const inventory = heavyRain
      ? `음료 재료 10% 감축 발주, 포장용 컵·빨대 20% 증량`
      : hotDay
        ? `아이스 음료 재료 40% 증량, 얼음 여분 확보`
        : `평시 발주량 유지`

    const staffing = isWeekend
      ? `피크타임(11~14시, 17~19시) 카운터 1명 추가 배치`
      : heavyRain
        ? `배달·포장 전담 인력 1명 지정, 테이블 1/3 정리`
        : `기본 인원 유지`

    const promotion = heavyRain
      ? `비 오는 날 테이크아웃 500원 할인 + SNS 당일 게시`
      : hotDay
        ? `아이스 음료 2+1 이벤트 진행`
        : '해당 없음'

    return { date: f.date, dayLabel: label, weatherSummary, expectedSales: expected, salesChangePercent: changePct, inventoryAction: inventory, staffingAction: staffing, promotionAction: promotion }
  })

  const totalExpected = daily.reduce((s, d) => s + d.expectedSales, 0)

  return {
    title: `${a.storeName} 7일 운영 브리핑 (${start} ~ ${end})`,
    overallOutlook:
      `이번 주 ${a.storeName}은 장마 영향으로 다수 일에 강수가 예상되어 매출 변동이 클 것으로 전망됩니다. ` +
      `주간 예상 총매출은 ₩${totalExpected.toLocaleString()}으로, 강수일 매출 감소(-20%)와 주말 프리미엄(+12%)이 상쇄될 전망입니다. ` +
      `강수 예보일에는 포장·배달 프로모션과 재고 축소 전략을 사전 준비하세요.`,
    dailyForecasts: daily,
    weekSummary:
      `재고: 강수 예보일(5mm↑) 전날 음료 재료 10% 감축, 폭염일 아이스 재료 40% 증량. ` +
      `인력: 주말 피크타임 1명 추가, 강수일 배달 전담 1명 지정. ` +
      `프로모션: 비 오는 날 테이크아웃 할인 쿠폰을 전날 SNS에 예고 게시하면 방문율 하락을 보완할 수 있습니다. ` +
      `핵심 체크포인트는 매일 오전 6시 기상청 예보 재확인 후 당일 운영 계획 조정입니다.`,
    slackCard:
      `*${a.storeName} 주간 운영 브리핑* 📅\n` +
      daily.map((d) => {
        const sign = d.salesChangePercent >= 0 ? '+' : ''
        const icon = d.salesChangePercent <= -10 ? '🔴' : d.salesChangePercent < 0 ? '🟡' : '🟢'
        return `${icon} ${d.dayLabel} ₩${Math.round(d.expectedSales/10000)}만 (${sign}${d.salesChangePercent.toFixed(1)}%)`
      }).join(' | ') +
      `\n⚡ 강수일 포장 할인·재고 감축 적극 활용`,
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { analytics, forecast } = (await request.json()) as {
    analytics: StoreAnalytics
    forecast: DailyPoint[]
  }

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('NO_KEY')

    const context = buildContext(analytics, forecast)

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name:   'operational_briefing',
          strict: true,
          schema: SCHEMA,
        },
      } as Parameters<typeof openai.chat.completions.create>[0]['response_format'],
      messages: [
        {
          role: 'system',
          content:
            '당신은 카페 프랜차이즈 운영 전문 컨설턴트입니다. ' +
            '기상 예보와 과거 상관관계 데이터를 결합해 일별 매출 예측과 실행 가능한 운영 지침을 한국어로 제공합니다. ' +
            '예상 매출은 일평균에 기상 효과를 적용해 구체적인 수치로 산출하세요.',
        },
        {
          role: 'user',
          content:
            `${analytics.storeName}의 향후 7일 운영 브리핑을 작성해주세요. ` +
            `과거 기상-매출 상관관계와 7일 예보를 반드시 활용해 일별 매출을 예측하고 ` +
            `재고·인력·프로모션 액션을 제시하세요.\n\n${context}`,
        },
      ],
    })

    const raw = JSON.parse(
      completion.choices[0]?.message?.content ?? '{}',
    ) as OperationalBriefing

    return NextResponse.json({ content: format(raw), raw })
  } catch {
    const raw = buildDemoBriefing(analytics, forecast)
    return NextResponse.json({ content: format(raw), raw })
  }
}
