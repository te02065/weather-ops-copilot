/**
 * 이 파일이 하는 일: 날짜별 특징 표(FeatureRow)를 만듭니다. 매출, 달력, 날씨를 날짜로 합칩니다.
 * 입력: 매출 행, 날씨 행, 달력 입력, 기준일(cutoff)
 * 출력: 기준일 이하 날짜의 FeatureRow 배열
 * 주의점: 누수 방지 (설계 F6, 방법론 §5.3). 기준일 이후의 매출·날씨는 읽지 않습니다.
 *         전일 기온 차는 전날 값만 씁니다. 강수 구간 경계는 config 값만 씁니다.
 *         "유효 영업일" = 매출이 0보다 크고, 휴무·공휴일·프로모션·행사가 아닌 날 (방법론 §1).
 */

import { CONFIG } from './config'
import { addDaysIso, dayOfWeek } from './dates'
import { dayCalendar } from './calendar'
import { comfortTempC } from './comfort'
import type { CalendarEvent, DailyWeather, FeatureRow, SalesInputRow } from './types'

export interface FeatureInput {
  sales: SalesInputRow[]
  weather: DailyWeather[]
  events: CalendarEvent[]
}

/** 강수량을 구간으로 나눕니다 (방법론 §4). 0.1mm 미만 none, 10mm 미만 light, 10mm 이상 heavy. */
export function rainBand(precipMm: number | null): FeatureRow['rainBand'] {
  if (precipMm === null) return null
  if (precipMm < CONFIG.rainNoneMaxMm) return 'none'
  if (precipMm < CONFIG.rainHeavyMinMm) return 'light'
  return 'heavy'
}

/** 유효 영업일인지 (학습과 기준선에 쓸 날). */
export function isValidDay(row: FeatureRow): boolean {
  return row.y !== null && row.y > 0 && !row.isClosed && !row.isHoliday && !row.isPromo && !row.flags.includes('event')
}

/**
 * 기준일(cutoff) 이하의 날짜만으로 특징을 만듭니다.
 * 기준일 이후 데이터는 처음부터 무시하므로, 그 데이터를 바꿔도 결과가 같아야 합니다 (누수 테스트).
 */
export function buildFeatures(input: FeatureInput, cutoff: string): FeatureRow[] {
  const sales = input.sales.filter((r) => r.date <= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1))
  const wx = new Map(input.weather.filter((w) => w.date <= cutoff).map((w) => [w.date, w]))
  const out: FeatureRow[] = []
  let validSoFar = 0
  for (const s of sales) {
    const row = makeRow(s, wx.get(s.date), wx.get(addDaysIso(s.date, -1)), input.events, validSoFar)
    out.push(row)
    if (isValidDay(row)) validSoFar++
  }
  return out
}

/** 한 날짜의 특징 행. 전날 날씨(prev)가 있을 때만 기온 차를 계산합니다. */
function makeRow(
  s: SalesInputRow,
  today: DailyWeather | undefined,
  prev: DailyWeather | undefined,
  events: CalendarEvent[],
  validBefore: number,
): FeatureRow {
  const cal = dayCalendar(s.date, events)
  const flags = [...s.flags]
  if (cal.hasEvent) flags.push('event')
  if (!today || today.precipMm === null) flags.push('weather_missing')
  const tempDelta =
    today?.tempAvg != null && prev?.tempAvg != null ? today.tempAvg - prev.tempAvg : undefined
  if (tempDelta !== undefined && Math.abs(tempDelta) >= CONFIG.tempJumpC) flags.push('temp_jump')
  const row: FeatureRow = {
    date: s.date,
    y: s.sales,
    dow: dayOfWeek(s.date),
    isHoliday: cal.isHoliday,
    isClosed: cal.isClosed || s.sales === 0, // 매출 0원은 휴무 후보이며, 확정 전에는 제외합니다
    isPromo: cal.isPromo,
    rainBand: rainBand(today?.precipMm ?? null),
    tempAvg: today?.tempAvg ?? null,
    tempMax: today?.tempMax ?? null,
    tempMin: today?.tempMin ?? null,
    trendIdx: validBefore / CONFIG.maxTrainWindowDays,
    weatherSource: 'observed',
    flags,
  }
  const comfort = comfortTempC(today?.tempAvg ?? null, today?.windMs ?? null)
  if (comfort !== undefined) row.comfortC = comfort
  if (tempDelta !== undefined) row.tempDelta = tempDelta
  return row
}
