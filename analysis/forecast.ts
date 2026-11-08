/**
 * 이 파일이 하는 일: 목표일의 예측을 만듭니다 (D+1 등). 날씨 모델 M1과 기준선 A, 상태 코드, 효과를 함께 돌려줍니다.
 * 입력: 과거 특징 행 (기준일까지), 학습된 M1 모델, 목표일, 목표일 날씨(예보 또는 없음), 달력 입력
 * 출력: Prediction (예상 매출, 기준선, 변화율, 상태, 효과, 표본 수)
 * 주의점:
 *   - 목표일 날씨가 없으면 예보 없음(forecast_unavailable)으로 보고 기준선만 냅니다 (방법론 §4, 강수확률을 mm로 바꾸지 않음).
 *   - 날씨 모델 예측값은 상태가 ok일 때만 씁니다. 그 밖의 상태에서는 기준선만 보여 줍니다.
 *   - 효과(%)는 해당 구간 표본이 기준(8일) 이상일 때만 출력합니다 (방법론 G4).
 *   - 이 파일은 예보를 가져오지 않습니다. 목표일 날씨는 호출하는 쪽이 넣습니다 (예보 연결은 8단계 이후).
 */

import { CONFIG } from './config'
import { baselineA } from './baseline'
import { dayCalendar } from './calendar'
import { isValidDay, rainBand } from './features'
import { effectsPct, predictM1, trainingRows, type M1Model } from './regression'
import { evaluateStatus, type StatusCode } from './status'
import type { CalendarEvent, DailyWeather, FeatureRow } from './types'

export interface Factor {
  name: 'rain_light' | 'rain_heavy' | 'temp'
  effectPct: number
  sampleSize: number
}

export interface Prediction {
  targetDate: string
  modelVersion: string
  expectedSales: number | null  // ok일 때만 날씨 모델 값, 아니면 null
  baselineSales: number | null  // 기준선 A
  changeRatePct: number | null  // 기준선 대비 변화율 (%)
  status: StatusCode
  statusText: string
  factors: Factor[]
  sampleSize: number            // 학습 유효 영업일 수
  sourceNote: 'observed_only'   // 예보 오차 미반영 여부 표시
}

export function predictTarget(
  rows: FeatureRow[],
  model: M1Model,
  cutoff: string,
  target: { date: string; weather: DailyWeather | null; events: CalendarEvent[] },
): Prediction {
  const train = trainingRows(rows, cutoff)
  const band = rainBand(target.weather?.precipMm ?? null)
  const bandDays = {
    light: train.filter((r) => r.rainBand === 'light').length,
    heavy: train.filter((r) => r.rainBand === 'heavy').length,
  }
  const status = evaluateStatus({
    trainDays: train.length,
    rainDays: train.filter((r) => r.rainBand !== 'none').length,
    bandDays,
    weatherMissingRatio: missingRatio(rows, cutoff),
    forecastPrecipKnown: target.weather !== null && target.weather.precipMm !== null,
    staleWeather: false,
    targetRainBand: band,
  })
  const base = baselineA(rows, target.date).value
  const modelValue = status.code === 'ok' && target.weather ? predictM1(model, targetRow(target, rows)) : null
  return {
    targetDate: target.date,
    modelVersion: model.version,
    expectedSales: modelValue,
    baselineSales: base,
    changeRatePct: modelValue !== null && base !== null && base !== 0 ? ((modelValue - base) / base) * 100 : null,
    status: status.code,
    statusText: status.text,
    factors: factorsFor(model, band, bandDays, train.length, status.code === 'ok'),
    sampleSize: train.length,
    sourceNote: 'observed_only',
  }
}

/** 효과 목록. 강수 구간은 표본이 기준 이상일 때만, 기온은 모델이 ok일 때만 냅니다. */
function factorsFor(
  model: M1Model,
  band: FeatureRow['rainBand'],
  bandDays: { light: number; heavy: number },
  trainDays: number,
  ok: boolean,
): Factor[] {
  const e = effectsPct(model)
  const out: Factor[] = []
  if (band === 'light' && bandDays.light >= CONFIG.minBandDays) out.push({ name: 'rain_light', effectPct: e.rainLight, sampleSize: bandDays.light })
  if (band === 'heavy' && bandDays.heavy >= CONFIG.minBandDays) out.push({ name: 'rain_heavy', effectPct: e.rainHeavy, sampleSize: bandDays.heavy })
  if (ok) out.push({ name: 'temp', effectPct: e.tempPerC, sampleSize: trainDays })
  return out
}

/** 목표일의 설계 입력 한 줄. M1이 쓰는 값(요일, 달력, 강수 구간, 기온, 추세)만 채웁니다. */
function targetRow(target: { date: string; weather: DailyWeather | null; events: CalendarEvent[] }, rows: FeatureRow[]): FeatureRow {
  const cal = dayCalendar(target.date, target.events)
  const validCount = rows.filter(isValidDay).length
  const w = target.weather
  return {
    date: target.date,
    y: null,
    dow: new Date(`${target.date}T00:00:00Z`).getUTCDay(),
    isHoliday: cal.isHoliday,
    isClosed: false,
    isPromo: cal.isPromo,
    rainBand: rainBand(w?.precipMm ?? null),
    tempAvg: w?.tempAvg ?? null,
    tempMax: w?.tempMax ?? null,
    tempMin: w?.tempMin ?? null,
    trendIdx: validCount / CONFIG.maxTrainWindowDays,
    weatherSource: 'observed',
    flags: [],
  }
}

/** 최근 학습 기간에서 날씨 강수가 빠진 날의 비율. */
function missingRatio(rows: FeatureRow[], cutoff: string): number {
  const window = rows.filter((r) => r.date <= cutoff && isValidDay(r))
  if (window.length === 0) return 1
  return window.filter((r) => r.rainBand === null).length / window.length
}
