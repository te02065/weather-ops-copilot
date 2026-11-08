/**
 * 이 파일이 하는 일: AI(LLM)에게 보내도 되는 항목만 골라 facts 객체를 만들고, 허용되지 않은 항목이 섞이면 막습니다.
 * 입력: 예측 결과(Prediction), 참고 제안(Recommendation), 매장 익명 코드, 목표일 날씨·세 기준·추이·메뉴 요약
 * 출력: BriefingFacts (허용 항목만), 또는 금지 항목이 들어 있을 때 오류
 * 주의점: 원본 행, 날짜별 매출 목록, 상호명, 주소, 이상치 목록은 절대 넣지 않습니다 (설계 §8).
 *         허용 목록은 설계 §8의 AI 전송 허용 필드와 같습니다. 여기에 항목을 더하려면 설계서부터 고칩니다.
 *         추가 항목(weather, criteria, outlookDirection, outlookReason, menuMovers, week)은 날씨 예보와 집계값만 담습니다.
 *         매출은 목표일 한 날의 집계(원 단위)와 메뉴 이름만 보냅니다. 메뉴별 금액은 보내지 않습니다.
 */

import { makeStageError, type StageError } from '../analysis/errors'
import type { Prediction } from '../analysis/forecast'
import type { Recommendation } from '../analysis/recommend'

export const ALLOWED_FACT_KEYS = [
  'storeCode', 'targetDate', 'expectedSales', 'baselineSales', 'changeRatePct',
  'rainBand', 'tempAvg', 'factors', 'recommendations', 'status', 'sampleSizes',
  'weather', 'criteria', 'outlookDirection', 'outlookReason', 'menuMovers', 'week', 'targetLabel',
] as const

/** 이름만 봐도 금지된 항목(상호명, 원본 행, 날짜별 목록 등). 허용 목록에 있어도 이 이름이면 막습니다. */
const FORBIDDEN_KEYS = ['storeName', 'address', 'rows', 'scatter', 'outliers', 'daily', 'totalSales', 'date_list', 'dates']

/** AI와 화면 문장에 쓰는 이름. 내부 이름(rain_light 등)은 여기서 한국어로 바꿉니다. */
export const FACTOR_LABEL: Record<string, string> = {
  rain_light: '약한 비가 온 날',
  rain_heavy: '강한 비가 온 날',
  temp: '기온(1℃당)',
}

/** 목표일 날씨 예보 (예보 기준). 값이 없으면 null. */
export interface BriefingWeather {
  sky: string | null          // 맑음, 구름많음, 흐림
  tempMin: number | null      // ℃, 정수
  tempMax: number | null      // ℃, 정수
  precipMm: number | null     // 예상 강수량 (mm, 소수 한 자리)
  popPct: number | null       // 강수확률 (%, 정수)
}

/** 목표일 ①②③ 세 기준 (금액은 원 단위 정수). */
export interface BriefingCriteria {
  sameWeekdayAvg: number | null
  sameWeekdayN: number
  lastYearSales: number | null
  sameWeatherName: string     // 예: 비 없는 날 평균 매출
  sameWeatherAvg: number | null
  sameWeatherN: number
  sameWeatherRange: [number, number] | null
}

/** 이번 7일의 추이 개수 (날씨 자료가 있는 날 기준). */
export interface BriefingWeek { more: number; less: number; similar: number; known: number }

/** 사장님이 읽는 날짜 표기. 예: 11월 9일(월). 브리핑에서는 '목표일' 대신 이 표기를 씁니다. */
export function dateLabelKo(iso: string): string {
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${iso}T00:00:00Z`).getUTCDay()]
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${dow})`
}

export interface BriefingFacts {
  storeCode: string
  targetDate: string
  targetLabel?: string | null  // 예: 11월 9일(월)
  expectedSales: number | null   // 원, 정수
  baselineSales: number | null   // 원, 정수
  changeRatePct: number | null   // %, 정수
  rainBand: string | null
  tempAvg: number | null         // ℃, 정수
  factors: Array<{ label: string; effectPct: number }>  // effectPct는 % 정수
  recommendations: string[]
  status: string
  sampleSizes: Record<string, number>  // 키는 한국어 이름
  weather?: BriefingWeather | null
  criteria?: BriefingCriteria | null
  outlookDirection?: 'more' | 'less' | 'similar' | 'unknown' | null
  outlookReason?: string | null
  menuMovers?: string[] | null   // 날씨에 따라 많이 달라지는 메뉴 이름 (금액 없음)
  week?: BriefingWeek | null
}

export interface BuildFactsInput {
  storeCode: string
  prediction: Prediction
  recommendations: Recommendation[]
  rainBand: string | null
  tempAvg: number | null
  weather?: BriefingWeather | null
  criteria?: BriefingCriteria | null
  outlookDirection?: BriefingFacts['outlookDirection']
  outlookReason?: string | null
  menuMovers?: string[] | null
  week?: BriefingWeek | null
  targetLabel?: string | null
}

export function buildFacts(input: BuildFactsInput): BriefingFacts {
  const p = input.prediction
  const whole = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x))
  return {
    storeCode: input.storeCode,
    targetDate: p.targetDate,
    expectedSales: whole(p.expectedSales),
    baselineSales: whole(p.baselineSales),
    changeRatePct: whole(p.changeRatePct),
    rainBand: input.rainBand,
    tempAvg: whole(input.tempAvg),
    factors: p.factors.map((f) => ({ label: FACTOR_LABEL[f.name] ?? '기타 요인', effectPct: Math.round(f.effectPct) })),
    recommendations: input.recommendations.map((r) => r.text),
    status: p.status,
    sampleSizes: { '학습한 날': p.sampleSize, ...Object.fromEntries(p.factors.map((f) => [FACTOR_LABEL[f.name] ?? '기타 요인', f.sampleSize])) },
    weather: input.weather ?? null,
    criteria: input.criteria ?? null,
    outlookDirection: input.outlookDirection ?? null,
    outlookReason: input.outlookReason ?? null,
    menuMovers: input.menuMovers ?? null,
    week: input.week ?? null,
    targetLabel: dateLabelKo(p.targetDate),
  }
}

/** 허용 목록 밖의 항목이나 금지 항목이 있으면 오류를 돌려줍니다. 없으면 null. */
export function checkFactsAllowed(obj: Record<string, unknown>): StageError | null {
  const extra = Object.keys(obj).filter((k) => !(ALLOWED_FACT_KEYS as readonly string[]).includes(k))
  const forbidden = extra.filter((k) => FORBIDDEN_KEYS.includes(k))
  const bad = forbidden.length > 0 ? forbidden : extra
  if (bad.length === 0) return null
  return makeStageError('briefing.check', 'E_FACT_FORBIDDEN',
    `AI로 보낼 수 없는 항목이 있습니다: ${bad.join(', ')}`,
    '허용된 집계 항목만 남기세요. 원본 행이나 상호명은 AI 요청에 넣지 않습니다.')
}
