/**
 * 이 파일이 하는 일: analysis/features.ts, calendar.ts, comfort.ts 테스트 (강수 구간, 누수, 유효 영업일, 전일 차, 체감온도).
 * 입력: 테스트 안에 적은 합성 행 (실제 매출 아님)
 * 출력: 테스트 통과/실패
 * 주의점: 누수 테스트는 기준일 이후 값을 바꿔도 기준일 이전 결과가 같은지 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFeatures, rainBand, isValidDay } from '../../analysis/features'
import { comfortTempC } from '../../analysis/comfort'
import type { CalendarEvent, DailyWeather, SalesInputRow } from '../../analysis/types'

function sale(date: string, sales: number | null, flags: string[] = []): SalesInputRow {
  return { row: 0, date, sales, transactions: null, iceSales: null, hotSales: null, flags }
}
function wx(date: string, precip: number | null, tempAvg: number | null, windMs: number | null = null): DailyWeather {
  return { date, precipMm: precip, tempAvg, tempMax: tempAvg, tempMin: tempAvg, windMs }
}

test('강수 구간 경계: 0.1mm 미만 none, 10mm 이상 heavy', () => {
  assert.equal(rainBand(0), 'none')
  assert.equal(rainBand(0.09), 'none')
  assert.equal(rainBand(0.1), 'light')
  assert.equal(rainBand(9.99), 'light')
  assert.equal(rainBand(10), 'heavy')
  assert.equal(rainBand(null), null)
})

test('누수 방지: 기준일 이후 매출과 날씨를 바꿔도 기준일 이전 특징은 같다', () => {
  const sales = [sale('2026-03-01', 100), sale('2026-03-02', 110), sale('2026-03-03', 120)]
  const weather = [wx('2026-03-01', 0, 5), wx('2026-03-02', 3, 6), wx('2026-03-03', 0, 7)]
  const before = buildFeatures({ sales, weather, events: [] }, '2026-03-02')
  // 기준일(03-02) 이후 값을 크게 바꿈
  const changedSales = [sale('2026-03-01', 100), sale('2026-03-02', 110), sale('2026-03-03', 999999)]
  const changedWeather = [wx('2026-03-01', 0, 5), wx('2026-03-02', 3, 6), wx('2026-03-03', 50, -20)]
  const after = buildFeatures({ sales: changedSales, weather: changedWeather, events: [] }, '2026-03-02')
  assert.deepEqual(after, before)
  assert.equal(after.some((r) => r.date === '2026-03-03'), false) // 기준일 이후 날짜는 아예 없음
})

test('전일 기온 차는 전날 값으로 계산하고, 전날이 없으면 비운다', () => {
  const rows = buildFeatures({
    sales: [sale('2026-03-02', 100)],
    weather: [wx('2026-03-01', 0, 6), wx('2026-03-02', 1, 10)],
    events: [],
  }, '2026-03-02')
  assert.equal(rows[0]!.tempDelta, 4)
  const alone = buildFeatures({ sales: [sale('2026-03-02', 100)], weather: [wx('2026-03-02', 1, 10)], events: [] }, '2026-03-02')
  assert.equal(alone[0]!.tempDelta, undefined)
})

test('매출 0원은 휴무 후보로 표시하고 유효 영업일에서 뺀다', () => {
  const [r] = buildFeatures({ sales: [sale('2026-03-02', 0, ['closed_candidate'])], weather: [wx('2026-03-02', 0, 5)], events: [] }, '2026-03-02')
  assert.equal(r!.isClosed, true)
  assert.equal(isValidDay(r!), false)
})

test('달력 행사는 event 플래그를 붙이고 유효 영업일에서 뺀다', () => {
  const events: CalendarEvent[] = [{ date: '2026-03-02', type: 'event', label: '합성 행사' }]
  const [r] = buildFeatures({ sales: [sale('2026-03-02', 100)], weather: [wx('2026-03-02', 0, 5)], events }, '2026-03-02')
  assert.ok(r!.flags.includes('event'))
  assert.equal(isValidDay(r!), false)
})

test('추세 인덱스는 유효 영업일이 지난 만큼만 올라간다', () => {
  const sales = [sale('2026-03-01', 100), sale('2026-03-02', 0), sale('2026-03-03', 100)]
  const weather = [wx('2026-03-01', 0, 5), wx('2026-03-02', 0, 5), wx('2026-03-03', 0, 5)]
  const rows = buildFeatures({ sales, weather, events: [] }, '2026-03-03')
  assert.equal(rows[0]!.trendIdx, 0)
  assert.equal(rows[1]!.trendIdx, 1 / 365)
  assert.equal(rows[2]!.trendIdx, 1 / 365) // 휴무 후보는 세지 않음
})

test('날씨가 없는 날은 weather_missing 플래그와 결측 강수', () => {
  const [r] = buildFeatures({ sales: [sale('2026-03-02', 100)], weather: [], events: [] }, '2026-03-02')
  assert.ok(r!.flags.includes('weather_missing'))
  assert.equal(r!.rainBand, null)
})

test('체감온도: 기온 10℃ 이하, 풍속 1.3m/s 이상일 때만 계산한다', () => {
  assert.equal(comfortTempC(15, 3), undefined)
  assert.equal(comfortTempC(5, 0.5), undefined)
  assert.equal(comfortTempC(null, 3), undefined)
  const v = comfortTempC(0, 5)
  assert.ok(v !== undefined && v < 0) // 0℃에서 바람이 세면 체감은 0℃보다 낮음
})
