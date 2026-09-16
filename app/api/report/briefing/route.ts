/**
 * POST /api/report/briefing
 * Body: { analytics: StoreAnalytics, forecast: DailyPoint[], lang?: 'ko' | 'en' }
 * Returns: { content: string, raw: OperationalBriefing }
 *
 * GPT-5.6 structured output — 7-day operational briefing (sales forecast +
 * inventory / staffing / promotion). Responds in the requested language
 * (default 'ko').
 */

import { NextResponse } from 'next/server'
import { openai, MODEL } from '@/lib/openai'
import type { StoreAnalytics } from '@/lib/analytics'
import type { DailyPoint } from '@/lib/weather'
import type { Lang } from '@/lib/i18n/dictionary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── JSON Schema (strict mode) ─────────────────────────────────────────────────

const DAILY_ITEM = {
  type: 'object',
  properties: {
    date:               { type: 'string', description: 'YYYY-MM-DD' },
    dayLabel:           { type: 'string', description: 'e.g. 9/16(Wed)' },
    weatherSummary:      { type: 'string', description: 'One-line weather summary (with an emoji)' },
    expectedSales:      { type: 'number', description: 'Expected daily sales (KRW, integer)' },
    salesChangePercent: { type: 'number', description: 'Change vs. average daily sales (%, 1 decimal place)' },
    inventoryAction:    { type: 'string', description: 'Inventory adjustment instruction (specific items/quantities)' },
    staffingAction:     { type: 'string', description: 'Staffing instruction (specific headcount/time slots)' },
    promotionAction:    { type: 'string', description: 'Promotion suggestion, or "None" if not applicable' },
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
      description: 'Briefing title, including store name and date range',
    },
    overallOutlook: {
      type: 'string',
      description: 'Weekly weather/sales outlook (2-3 sentences, with concrete figures)',
    },
    dailyForecasts: {
      type: 'array',
      description: '7 daily forecasts with operational instructions',
      items: DAILY_ITEM,
    },
    weekSummary: {
      type: 'string',
      description: 'Weekly operations summary combining inventory, staffing, and promotion guidance (3-5 sentences)',
    },
    slackCard: {
      type: 'string',
      description: 'Slack-ready markdown message. Use *bold*, ~strikethrough~, and emoji freely. A summary under 150 chars, then per-day highlights.',
    },
  },
  required: ['title', 'overallOutlook', 'dailyForecasts', 'weekSummary', 'slackCard'],
  additionalProperties: false,
}

// ── Context builder ───────────────────────────────────────────────────────────

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'] as const
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function buildContext(a: StoreAnalytics, forecast: DailyPoint[], lang: Lang): string {
  const c = a.correlations
  const dowLabels = lang === 'en' ? DOW_EN : DOW_KR

  const fcastStr = forecast
    .map((f) => {
      const dow = dowLabels[new Date(f.date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6]
      const [, m, d] = f.date.split('-')
      return lang === 'en'
        ? `  ${m}/${d}(${dow})  high ${f.tempMax}°C  feels-like ${f.apparentTempMax}°C  precip ${f.precip}mm`
        : `  ${m}/${d}(${dow})  최고${f.tempMax}°C  체감${f.apparentTempMax}°C  강수${f.precip}mm`
    })
    .join('\n')

  if (lang === 'en') {
    return [
      `Store: ${a.storeName}`,
      `Baseline avg daily sales: ₩${a.summary.avgDailySales.toLocaleString()}`,
      '',
      '[Weather-sales correlation rules (measured over the past year)]',
      `  Precip >= 5mm  -> sales ~-20%  (r = ${c.salesVsPrecip})`,
      `  Precip 2-5mm   -> sales ~-8%`,
      `  Temp >= 30°C   -> iced-drink ratio surges  (r = ${c.iceRatioVsTemp})`,
      `  Weekend (Sat/Sun) -> sales avg +12%`,
      '',
      '[7-day weather forecast]',
      fcastStr,
    ].join('\n')
  }

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

function format(b: OperationalBriefing, lang: Lang): string {
  const dailyHeader   = lang === 'en' ? '── Daily Forecast ─────────────────────────' : '── 일별 예측 ──────────────────────────────'
  const summaryHeader = lang === 'en' ? '── Week Summary ───────────────────────────' : '── 주간 요약 ──────────────────────────────'
  const slackHeader   = lang === 'en' ? '── Slack Card ─────────────────────────────' : '── Slack 카드 ──────────────────────────────'
  const invIcon = lang === 'en' ? '📦 Inventory' : '📦 재고'
  const staffIcon = lang === 'en' ? '👥 Staffing' : '👥 인력'
  const promoIcon = lang === 'en' ? '🎯 Promotion' : '🎯 프로모션'
  const none = lang === 'en' ? 'None' : '해당 없음'

  const lines: string[] = [
    `📅 ${b.title}`,
    '',
    b.overallOutlook,
    '',
    dailyHeader,
    '',
  ]

  b.dailyForecasts.forEach((d) => {
    const sign   = d.salesChangePercent >= 0 ? '+' : ''
    const bullet = d.salesChangePercent <= -10 ? '🔴' : d.salesChangePercent < 0 ? '🟡' : '🟢'
    lines.push(
      `${bullet} ${d.dayLabel}  ₩${d.expectedSales.toLocaleString()}  (${sign}${d.salesChangePercent.toFixed(1)}%)`,
    )
    lines.push(`   🌤️ ${d.weatherSummary}`)
    lines.push(`   ${invIcon}: ${d.inventoryAction}`)
    lines.push(`   ${staffIcon}: ${d.staffingAction}`)
    if (d.promotionAction !== none) {
      lines.push(`   ${promoIcon}: ${d.promotionAction}`)
    }
    lines.push('')
  })

  lines.push(summaryHeader)
  lines.push(b.weekSummary)
  lines.push('')
  lines.push(slackHeader)
  lines.push(b.slackCard)

  return lines.join('\n')
}

// ── Demo fallback (pre-generated content, used when no API key / API failure) ─

function buildDemoBriefing(a: StoreAnalytics, forecast: DailyPoint[], lang: Lang): OperationalBriefing {
  const avg   = a.summary.avgDailySales
  const dowLabels = lang === 'en' ? DOW_EN : DOW_KR
  const start = forecast[0]?.date ?? ''
  const end   = forecast[forecast.length - 1]?.date ?? ''

  const daily: DailyForecast[] = forecast.slice(0, 7).map((f) => {
    const dow   = dowLabels[new Date(f.date).getDay() as 0|1|2|3|4|5|6]
    const [, m, d] = f.date.split('-')
    const label = `${m}/${d}(${dow})`
    const isWeekend  = dow === dowLabels[0] || dow === dowLabels[6]
    const heavyRain  = f.precip >= 5
    const lightRain  = f.precip >= 2 && f.precip < 5
    const hotDay     = f.tempMax >= 30

    let changePct = 0
    if (heavyRain)  changePct -= 20
    else if (lightRain) changePct -= 8
    if (isWeekend)  changePct += 12
    changePct = Math.round(changePct * 10) / 10

    const expected = Math.round(avg * (1 + changePct / 100) / 1000) * 1000

    let weatherSummary: string
    let inventory: string
    let staffing: string
    let promotion: string

    if (lang === 'en') {
      weatherSummary = `High ${f.tempMax}°C`
      if (heavyRain)  weatherSummary += `, heavy rain ${f.precip}mm ☔ stay-in weather`
      else if (lightRain) weatherSummary += `, light rain ${f.precip}mm 🌧`
      else if (hotDay)    weatherSummary += `, heat advisory ☀️`
      else weatherSummary += `, clear 🌤`

      inventory = heavyRain
        ? `Cut beverage ingredient orders 10%; stock up 20% extra takeout cups/straws`
        : hotDay
          ? `Order 40% extra iced-drink ingredients; secure extra ice`
          : `Maintain normal order volume`

      staffing = isWeekend
        ? `Add 1 counter staff during peak hours (11-14h, 17-19h)`
        : heavyRain
          ? `Assign 1 staff to delivery/takeout; clear 1/3 of seating`
          : `Maintain baseline staffing`

      promotion = heavyRain
        ? `₩500 takeout discount for rainy days + same-day social post`
        : hotDay
          ? `Run a buy-2-get-1 iced drink promotion`
          : 'None'
    } else {
      weatherSummary = `최고 ${f.tempMax}°C`
      if (heavyRain)  weatherSummary += `, 강한 비 ${f.precip}mm ☔ 외출 자제`
      else if (lightRain) weatherSummary += `, 약한 비 ${f.precip}mm 🌧`
      else if (hotDay)    weatherSummary += `, 폭염 주의 ☀️`
      else weatherSummary += `, 맑음 🌤`

      inventory = heavyRain
        ? `음료 재료 10% 감축 발주, 포장용 컵·빨대 20% 증량`
        : hotDay
          ? `아이스 음료 재료 40% 증량, 얼음 여분 확보`
          : `평시 발주량 유지`

      staffing = isWeekend
        ? `피크타임(11~14시, 17~19시) 카운터 1명 추가 배치`
        : heavyRain
          ? `배달·포장 전담 인력 1명 지정, 테이블 1/3 정리`
          : `기본 인원 유지`

      promotion = heavyRain
        ? `비 오는 날 테이크아웃 500원 할인 + SNS 당일 게시`
        : hotDay
          ? `아이스 음료 2+1 이벤트 진행`
          : '해당 없음'
    }

    return { date: f.date, dayLabel: label, weatherSummary, expectedSales: expected, salesChangePercent: changePct, inventoryAction: inventory, staffingAction: staffing, promotionAction: promotion }
  })

  const totalExpected = daily.reduce((s, d) => s + d.expectedSales, 0)

  if (lang === 'en') {
    return {
      title: `${a.storeName} 7-Day Operational Briefing (${start} ~ ${end})`,
      overallOutlook:
        `This week, ${a.storeName} is expected to see rain on several days due to the monsoon, driving notable sales swings. ` +
        `Projected weekly sales total ₩${totalExpected.toLocaleString()}, as rain-day declines (-20%) roughly offset the weekend premium (+12%). ` +
        `Prepare takeout/delivery promotions and reduced ordering in advance of rainy forecasts.`,
      dailyForecasts: daily,
      weekSummary:
        `Inventory: cut beverage ingredients 10% the day before rain (5mm+), increase iced ingredients 40% on hot days. ` +
        `Staffing: add 1 person for the weekend peak, assign 1 delivery specialist on rainy days. ` +
        `Promotion: pre-announcing a rainy-day takeout discount coupon on social media the day before helps offset the foot-traffic drop. ` +
        `Key checkpoint: re-check the morning forecast daily at 6am and adjust the day's operating plan accordingly.`,
      slackCard:
        `*${a.storeName} Weekly Operations Briefing* 📅\n` +
        daily.map((d) => {
          const sign = d.salesChangePercent >= 0 ? '+' : ''
          const icon = d.salesChangePercent <= -10 ? '🔴' : d.salesChangePercent < 0 ? '🟡' : '🟢'
          return `${icon} ${d.dayLabel} ₩${Math.round(d.expectedSales/10000)}0k (${sign}${d.salesChangePercent.toFixed(1)}%)`
        }).join(' | ') +
        `\n⚡ Lean into takeout discounts and reduced ordering on rainy days`,
    }
  }

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
  const body = (await request.json()) as {
    analytics: StoreAnalytics
    forecast: DailyPoint[]
    lang?: Lang
  }
  const { analytics, forecast } = body
  const lang: Lang = body.lang === 'en' ? 'en' : 'ko'

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('NO_KEY')

    const context = buildContext(analytics, forecast, lang)

    const systemPrompt = lang === 'en'
      ? 'You are a business consultant specializing in cafe/retail franchise operations. ' +
        'Combine the weather forecast with historical correlation data to produce a daily sales forecast and actionable operating instructions, in English. ' +
        'Derive expected sales as a concrete figure by applying the weather effects to the average daily sales.'
      : '당신은 카페 프랜차이즈 운영 전문 컨설턴트입니다. ' +
        '기상 예보와 과거 상관관계 데이터를 결합해 일별 매출 예측과 실행 가능한 운영 지침을 한국어로 제공합니다. ' +
        '예상 매출은 일평균에 기상 효과를 적용해 구체적인 수치로 산출하세요.'

    const userPrompt = lang === 'en'
      ? `Write a 7-day operational briefing for ${analytics.storeName}. ` +
        `Use the historical weather-sales correlation and the 7-day forecast to predict daily sales, ` +
        `and provide inventory, staffing, and promotion actions.\n\n${context}`
      : `${analytics.storeName}의 향후 7일 운영 브리핑을 작성해주세요. ` +
        `과거 기상-매출 상관관계와 7일 예보를 반드시 활용해 일별 매출을 예측하고 ` +
        `재고·인력·프로모션 액션을 제시하세요.\n\n${context}`

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = JSON.parse(
      completion.choices[0]?.message?.content ?? '{}',
    ) as OperationalBriefing

    return NextResponse.json({ content: format(raw, lang), raw })
  } catch {
    const raw = buildDemoBriefing(analytics, forecast, lang)
    return NextResponse.json({ content: format(raw, lang), raw })
  }
}
