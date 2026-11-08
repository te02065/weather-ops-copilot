/**
 * 이 파일이 하는 일: 대시보드의 과거 기록 요약 (날씨별 평균, 요일×비 표, 기온 급변, 기본 통계, 달력 칸)을 만듭니다.
 * 입력: 특징 행 목록 (FeatureRow), 달력 월 (YYYY-MM)
 * 출력: 날씨 묶음별 평균, 요일×비 구간 표, 기온 급변 날 목록, 기본 통계, 월 달력 칸
 * 주의점: 유효 영업일만 셉니다 (휴무·공휴일·프로모션·행사 제외, 매출 0 제외). 표본이 적은 칸은 화면에서 "표본 부족"으로 둡니다.
 *         "맑음·흐림"은 일조 자료가 없어 구분하지 않습니다. "비 없음"은 강수량 기준입니다.
 *         이 값들은 과거 차이를 보여 줄 뿐 원인이 아닙니다.
 */

import { CONFIG } from './config'
import { isValidDay } from './features'
import type { FeatureRow } from './types'

export interface Group { key: string; label: string; avgSales: number; count: number }
export interface DowWeatherCell { avgSales: number | null; count: number }
export interface TempChange { date: string; tempDelta: number; sales: number; prevSales: number | null; changePct: number | null }
export interface DayMark { date: string; dow: number; sales: number | null; rainBand: FeatureRow['rainBand']; isHoliday: boolean; isClosed: boolean }
export interface BasicStats {
  avgSales: number | null
  max: { date: string; sales: number } | null
  min: { date: string; sales: number } | null
  range: number | null
  weekdayAvg: number | null
  weekendAvg: number | null
  count: number
}

type Band = 'none' | 'light' | 'heavy'

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length
}

/** 날씨 묶음별 평균 매출: 비 구간 3개 + 추움 + 더움. 날씨가 없는 날은 뺍니다. */
export function weatherGroups(rows: FeatureRow[]): Group[] {
  const valid = rows.filter(isValidDay)
  const make = (key: string, label: string, pick: (r: FeatureRow) => boolean): Group => {
    const xs = valid.filter(pick).map((r) => r.y as number)
    return { key, label, avgSales: mean(xs) ?? 0, count: xs.length }
  }
  return [
    make('none', '비 없음', (r) => r.rainBand === 'none'),
    make('light', '약한 비', (r) => r.rainBand === 'light'),
    make('heavy', '강한 비', (r) => r.rainBand === 'heavy'),
    make('cold', `추움 (${CONFIG.coldDayMaxC}℃ 이하)`, (r) => r.tempAvg !== null && r.tempAvg <= CONFIG.coldDayMaxC),
    make('hot', `더움 (${CONFIG.hotDayMinC}℃ 이상)`, (r) => r.tempAvg !== null && r.tempAvg >= CONFIG.hotDayMinC),
  ]
}

/** 요일(0~6) × 비 구간 평균 표. 표본이 minBandDays 미만이면 평균을 null로 둡니다. */
export function dowWeatherTable(rows: FeatureRow[]): Record<number, Record<Band, DowWeatherCell>> {
  const valid = rows.filter(isValidDay).filter((r) => r.rainBand !== null)
  const out: Record<number, Record<Band, DowWeatherCell>> = {}
  for (let dow = 0; dow < 7; dow++) {
    out[dow] = { none: cell(valid, dow, 'none'), light: cell(valid, dow, 'light'), heavy: cell(valid, dow, 'heavy') }
  }
  return out
}

function cell(valid: FeatureRow[], dow: number, band: Band): DowWeatherCell {
  const xs = valid.filter((r) => r.dow === dow && r.rainBand === band).map((r) => r.y as number)
  return { count: xs.length, avgSales: xs.length < CONFIG.minBandDays ? null : mean(xs) }
}

/** 전날 대비 기온 차가 tempJumpC 이상인 날과 그날 매출 변화. 날짜 순. */
export function tempChanges(rows: FeatureRow[]): TempChange[] {
  const sorted = rows.filter((r) => r.y !== null).sort((a, b) => (a.date < b.date ? -1 : 1))
  const out: TempChange[] = []
  sorted.forEach((r, i) => {
    if (r.tempDelta === undefined || Math.abs(r.tempDelta) < CONFIG.tempJumpC) return
    const prev = i > 0 ? (sorted[i - 1]!.y as number) : null
    const sales = r.y as number
    out.push({
      date: r.date,
      tempDelta: r.tempDelta,
      sales,
      prevSales: prev,
      changePct: prev && prev > 0 ? ((sales - prev) / prev) * 100 : null,
    })
  })
  return out
}

export function basicStats(rows: FeatureRow[]): BasicStats {
  const valid = rows.filter(isValidDay)
  if (valid.length === 0) return { avgSales: null, max: null, min: null, range: null, weekdayAvg: null, weekendAvg: null, count: 0 }
  const sorted = [...valid].sort((a, b) => (b.y as number) - (a.y as number))
  const top = sorted[0]!
  const bottom = sorted[sorted.length - 1]!
  const weekend = valid.filter((r) => r.dow === 0 || r.dow === 6).map((r) => r.y as number)
  const weekday = valid.filter((r) => r.dow >= 1 && r.dow <= 5).map((r) => r.y as number)
  return {
    avgSales: mean(valid.map((r) => r.y as number)),
    max: { date: top.date, sales: top.y as number },
    min: { date: bottom.date, sales: bottom.y as number },
    range: (top.y as number) - (bottom.y as number),
    weekdayAvg: mean(weekday),
    weekendAvg: mean(weekend),
    count: valid.length,
  }
}

/** 한 달(YYYY-MM)의 날짜 칸. 자료가 없는 날도 칸은 만듭니다 (sales null). */
export function monthMarks(rows: FeatureRow[], yearMonth: string): DayMark[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return Array.from({ length: days }, (_, i) => {
    const date = `${yearMonth}-${String(i + 1).padStart(2, '0')}`
    const r = byDate.get(date)
    return {
      date,
      dow: new Date(`${date}T00:00:00Z`).getUTCDay(),
      sales: r && r.y !== null ? (r.y as number) : null,
      rainBand: r?.rainBand ?? null,
      isHoliday: r?.isHoliday ?? false,
      isClosed: r?.isClosed ?? false,
    }
  })
}
