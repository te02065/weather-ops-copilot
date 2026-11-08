/**
 * 이 파일이 하는 일: 예보 날짜마다 세 가지 기준의 일매출을 계산합니다 (명세 v0.1 §2).
 *   ① 같은 요일 과거 영업일 평균 (8일 이상일 때만)
 *   ② 작년 같은 날 매출 (1건이면 "1일 기록, 참고만")
 *   ③ 같은 날씨였던 과거 영업일 평균 (강수량이 있으면 그 구간, 강수확률만 있으면 두 구간 범위)
 * 입력: 특징 행(FeatureRow), 기준일(cutoff), 날짜, 예보 날씨(없으면 null)
 * 출력: ①②③ 값과 표본 수, 표시 상태
 * 주의점: 숫자는 계산 결과만 씁니다. 표본이 부족하면 값을 null로 두고, 화면은 "아직 비교할 날이 부족해요"를 씁니다.
 *         ②는 날짜당 1건이라 평균이라는 말을 쓰지 않습니다.
 *         강수확률 구간 기준(30%, 60%)은 config에 둡니다.
 */

import { CONFIG } from './config'
import { isValidDay, rainBand } from './features'
import { addDaysIso } from './dates'
import type { FestivalSets } from './festival'
import type { DailyWeather, FeatureRow } from './types'

export interface CriterionValue { avg: number | null; n: number; range?: [number, number] }
export interface LastYear { sales: number | null; note: 'none' | 'single' }
export interface DayCriteria {
  date: string
  dow: number
  weatherLabel: string          // 예보 날씨 한 줄 (비 없음, 약한 비, 강한 비, 비 가능성 높음 등)
  sameWeekday: CriterionValue   // ①
  lastYear: LastYear            // ②
  sameWeather: CriterionValue   // ③
  probabilityOnly: boolean      // 강수확률만 있었는지
  festival: 'none' | 'day' | 'excluded'  // 명절 당일(영향 가능) 또는 명절 전후(과거 비교에서 제외)
  forecast?: DailyWeather | null // 예보 원본 (기온, 하늘, 강수확률 표시용)
}

const BAND_LABEL = { none: '비 없음', light: '약한 비', heavy: '강한 비' } as const

/** 강수확률(%)을 두 구간으로 나눕니다. 낮은 쪽과 높은 쪽을 함께 씁니다. */
export function probabilityBands(prob: number): Array<'none' | 'light' | 'heavy'> {
  if (prob < CONFIG.rainProbLowPct) return ['none', 'light']
  if (prob < CONFIG.rainProbHighPct) return ['light', 'heavy']
  return ['heavy', 'light']
}

function avgOf(rows: FeatureRow[], pick: (r: FeatureRow) => boolean): CriterionValue {
  const xs = rows.filter(pick).map((r) => r.y as number)
  if (xs.length < CONFIG.minBandDays) return { avg: null, n: xs.length }
  return { avg: xs.reduce((s, x) => s + x, 0) / xs.length, n: xs.length }
}

export function threeCriteria(rows: FeatureRow[], cutoff: string, date: string, weather: DailyWeather | null, fest: FestivalSets = { days: new Set(), window: new Set() }): DayCriteria {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const past = rows.filter((r) => r.date <= cutoff && isValidDay(r) && !fest.window.has(r.date))
  const festival = fest.days.has(date) ? 'day' : fest.window.has(date) ? 'excluded' : 'none'
  const sameWeekday = avgOf(past, (r) => r.dow === dow)
  const lastYear = lastYearSales(past, date)
  const { weatherLabel, sameWeather, probabilityOnly } = weatherPart(past, weather)
  return { date, dow, weatherLabel, sameWeekday, lastYear, sameWeather, probabilityOnly, festival, forecast: weather }
}

function lastYearSales(past: FeatureRow[], date: string): LastYear {
  const prev = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`
  const hits = past.filter((r) => r.date === prev)
  if (hits.length === 0) return { sales: null, note: 'none' }
  return { sales: hits[0]!.y as number, note: 'single' }
}

function weatherPart(past: FeatureRow[], weather: DailyWeather | null): { weatherLabel: string; sameWeather: CriterionValue; probabilityOnly: boolean } {
  if (weather === null) return { weatherLabel: '예보 없음', sameWeather: { avg: null, n: 0 }, probabilityOnly: false }
  if (weather.precipMm !== null && weather.precipMm !== undefined) {
    const band = rainBand(weather.precipMm)!
    return {
      weatherLabel: BAND_LABEL[band],
      sameWeather: avgOf(past, (r) => r.rainBand === band),
      probabilityOnly: false,
    }
  }
  if (weather.rainProbPct !== null && weather.rainProbPct !== undefined) {
    const [a, b] = probabilityBands(weather.rainProbPct)
    const va = avgOf(past, (r) => r.rainBand === a)
    const vb = avgOf(past, (r) => r.rainBand === b)
    const values = [va.avg, vb.avg].filter((x): x is number => x !== null)
    const range: [number, number] | undefined = values.length === 2 ? [Math.min(...values), Math.max(...values)] : undefined
    return {
      weatherLabel: `비 가능성 ${weather.rainProbPct}%`,
      sameWeather: { avg: values.length ? values.reduce((s, x) => s + x, 0) / values.length : null, n: Math.min(va.n, vb.n), range },
      probabilityOnly: true,
    }
  }
  return { weatherLabel: '강수 정보 없음', sameWeather: { avg: null, n: 0 }, probabilityOnly: false }
}

/** 기준일 다음 날부터 N일의 날짜 목록 (YYYY-MM-DD). */
export function nextDates(startExclusive: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDaysIso(startExclusive, i + 1))
}

/** 예보 날씨를 비 구간으로 바꿉니다. 강수량이 있으면 한 구간, 강수확률만 있으면 두 구간. 없으면 null. */
export function forecastBands(w: DailyWeather | null | undefined): Array<'none' | 'light' | 'heavy'> | null {
  if (!w) return null
  if (w.precipMm !== null && w.precipMm !== undefined) return [rainBand(w.precipMm)!]
  if (w.rainProbPct !== null && w.rainProbPct !== undefined) return probabilityBands(w.rainProbPct)
  return null
}
