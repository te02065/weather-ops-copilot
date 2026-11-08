/**
 * 이 파일이 하는 일: 여러 날의 "추이 안내"를 만듭니다. 정확한 금액이 아니라 방향(많이·적게·비슷)과 대략의 범위입니다.
 * 입력: 과거 특징 행, 학습된 M1 모델, 기준일, 날짜, 그 날의 예보 날씨(없으면 null), 달력 입력
 * 출력: DayOutlook (방향, 대략 범위 하한·상한 (만 원 단위), 근거 한 줄)
 * 주의점: 화면에 정확한 금액을 쓰지 않습니다. 범위는 계산값에 ±outlookBandPct를 더한 것이고 만 원 단위로 반올림합니다.
 *         예보가 없는 날은 방향과 범위를 비워 두고 "예보 없음"이라고 씁니다. 숫자를 지어내지 않습니다.
 *         근거 문장은 과거 기록의 차이이며 원인을 단정하지 않습니다.
 */

import { CONFIG } from './config'
import { predictTarget, type Factor } from './forecast'
import { probabilityBands } from './threeCriteria'
import { trainingRows, type M1Model } from './regression'
import type { CalendarEvent, DailyWeather, FeatureRow } from './types'

export type Direction = 'more' | 'less' | 'similar' | 'unknown'

export interface DayOutlook {
  date: string
  dow: number
  direction: Direction
  rangeLow: number | null   // 원, 만 원 단위
  rangeHigh: number | null  // 원, 만 원 단위
  reason: string
}

/** 기준선 대비 변화율(%)을 방향으로 바꿉니다. 경계 안쪽(±outlookFlatPct)은 비슷함입니다. */
export function directionOf(changePct: number): Direction {
  if (changePct > CONFIG.outlookFlatPct) return 'more'
  if (changePct < -CONFIG.outlookFlatPct) return 'less'
  return 'similar'
}

/** 원 단위를 만 원 단위로 반올림합니다. */
export function roundToManWon(x: number): number {
  return Math.round(x / 10000) * 10000
}

export interface ReasonPart { pct: number; text: string }

const DOW_NAME = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** 강수 요인 한 줄. 과거 같은 날씨의 평소 대비 차이입니다. */
export function rainPart(f: Factor): ReasonPart {
  const dir = f.effectPct < 0 ? '적게' : '많이'
  const label = f.name === 'rain_heavy' ? '강한 비가 온 날' : '약한 비가 온 날'
  return { pct: f.effectPct, text: `${label}은 평소보다 약 ${Math.round(Math.abs(f.effectPct))}% ${dir} 팔린 경향 (${f.sampleSize}일 기록)` }
}

/** 기온 요인 한 줄. 학습 기간 평균 기온과 비교한 차이를 씁니다 (0℃ 기준 계수를 평균 차이에 적용). */
export function tempPart(beta: number, tempAvg: number, meanTemp: number): ReasonPart {
  const dev = tempAvg - meanTemp
  const pct = (Math.exp(beta * dev) - 1) * 100
  const cold = dev < 0
  const text = cold
    ? `같은 달 평균(${Math.round(meanTemp)}℃)보다 ${Math.round(-dev)}℃ 추워서 매출이 약 ${Math.round(Math.abs(pct))}% 적었던 경향`
    : `같은 달 평균(${Math.round(meanTemp)}℃)보다 ${Math.round(dev)}℃ 따뜻해서 매출이 약 ${Math.round(Math.abs(pct))}% 많았던 경향`
  return { pct, text }
}

/** 요일 요인 한 줄. 기준 요일은 일요일이므로 일요일이 아니면 일요일과 비교합니다. */
export function weekdayPart(beta: number, dow: number): ReasonPart {
  const pct = (Math.exp(beta) - 1) * 100
  const dir = pct < 0 ? '적게' : '많이'
  return { pct, text: `${DOW_NAME[dow]}은 일요일보다 약 ${Math.round(Math.abs(pct))}% ${dir} 팔리는 요일` }
}

/** 큰 요인부터 두 개까지 근거 한 줄로 잇습니다. 충분히 큰 요인이 없으면 기본 문장입니다. */
export function reasonFromParts(parts: ReasonPart[]): string {
  const big = parts
    .filter((p) => Math.abs(p.pct) >= CONFIG.outlookReasonMinPct)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 2)
  if (big.length === 0) return '요일과 최근 흐름을 기준으로 봤어요'
  return big.map((p) => p.text).join(' · ')
}

/**
 * 날짜 하나의 추이 (명세 §3, 2026-11-08 수정): 방향은 "보통 날씨"와 비교한 날씨 효과로 정합니다.
 * 보통 날씨 = 비 없음 + 학습 기간 평균 기온. 그래서 방향과 이유 문장이 같은 근거를 씁니다.
 * 요일 차이는 방향과 이유에서 뺍니다 (기준이 "같은 요일 평균"이기 때문입니다).
 */
export function outlookDay(
  rows: FeatureRow[],
  model: M1Model,
  cutoff: string,
  date: string,
  weather: DailyWeather | null,
  events: CalendarEvent[],
): DayOutlook {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (weather === null) {
    return { date, dow, direction: 'unknown', rangeLow: null, rangeHigh: null, reason: '예보를 받지 못해 추이를 보여 줄 수 없어요' }
  }
  const meanTemp = monthMeanTempOf(rows, cutoff, date)
  const typical = predictTarget(rows, model, cutoff, { date, weather: typicalWeather(date, meanTemp), events }).expectedSales
  if (typical === null) {
    return { date, dow, direction: 'unknown', rangeLow: null, rangeHigh: null, reason: '보통 날씨 기준을 만들 수 없어 추이를 보여 줄 수 없어요' }
  }
  if (weather.precipMm === null && weather.rainProbPct !== null && weather.rainProbPct !== undefined) {
    return probabilityOutlook(rows, model, cutoff, date, dow, weather, events, typical)
  }
  const p = predictTarget(rows, model, cutoff, { date, weather, events })
  if (p.expectedSales === null) {
    return { date, dow, direction: 'unknown', rangeLow: null, rangeHigh: null, reason: '예보 값이 부족해 추이를 보여 줄 수 없어요' }
  }
  const band = CONFIG.outlookBandPct / 100
  const parts: ReasonPart[] = p.factors.filter((f) => f.name !== 'temp').map(rainPart)
  if (weather.tempAvg !== null) parts.push(tempPart(model.beta.temp, weather.tempAvg, meanTemp))
  return {
    date,
    dow,
    direction: directionOf(changePct(p.expectedSales, typical)),
    rangeLow: roundToManWon(p.expectedSales * (1 - band)),
    rangeHigh: roundToManWon(p.expectedSales * (1 + band)),
    reason: reasonFromParts(parts),
  }
}

function changePct(value: number, typical: number): number {
  return typical === 0 ? 0 : ((value - typical) / typical) * 100
}

/**
 * 같은 달 평균 기온: 학습 기간 안에서 목표일과 같은 달(월)에 있었던 날들의 평균입니다.
 * 1년 평균을 쓰면 11월처럼 추운 달이 계절 차이로 "줄어든다"고 잘못 읽히므로 같은 달과 비교합니다.
 * 같은 달 기록이 없으면 학습 기간 전체 평균을 씁니다.
 */
export function monthMeanTempOf(rows: FeatureRow[], cutoff: string, date: string): number {
  const train = trainingRows(rows, cutoff)
  const month = date.slice(5, 7)
  const same = train.filter((r) => r.date.slice(5, 7) === month)
  const pool = same.length > 0 ? same : train
  return pool.reduce((s, r) => s + (r.tempAvg ?? 0), 0) / Math.max(pool.length, 1)
}

/** 보통 날씨: 비 없음, 학습 기간 평균 기온. */
function typicalWeather(date: string, meanTemp: number): DailyWeather {
  return { date, precipMm: 0, tempAvg: meanTemp, tempMax: null, tempMin: null, windMs: null }
}

/**
 * 강수확률만 있을 때: 확률이 가리키는 두 구간 각각에 대표 강수량을 넣어 계산하고, 두 결과의 범위를 씁니다 (명세 D-4).
 * 방향은 두 변화율의 평균으로 정합니다.
 */
function probabilityOutlook(
  rows: FeatureRow[], model: M1Model, cutoff: string, date: string, dow: number, weather: DailyWeather,
  events: CalendarEvent[], typical: number,
): DayOutlook {
  const bands = probabilityBands(weather.rainProbPct!)
  const results = bands.map((b) => predictTarget(rows, model, cutoff, {
    date,
    weather: { ...weather, precipMm: CONFIG.representativeMm[b] },
    events,
  }))
  const ok = results.filter((r) => r.expectedSales !== null)
  if (ok.length === 0) {
    return { date, dow, direction: 'unknown', rangeLow: null, rangeHigh: null, reason: '예보 값이 부족해 추이를 보여 줄 수 없어요' }
  }
  const expected = ok.map((r) => r.expectedSales!)
  const meanChange = expected.reduce((s, x) => s + changePct(x, typical), 0) / expected.length
  return {
    date,
    dow,
    direction: directionOf(meanChange),
    rangeLow: roundToManWon(Math.min(...expected)),
    rangeHigh: roundToManWon(Math.max(...expected)),
    reason: `비 가능성 ${weather.rainProbPct}%: 비가 올 때와 안 올 때를 함께 계산한 범위예요`,
  }
}
