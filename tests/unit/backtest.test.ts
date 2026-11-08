/**
 * 이 파일이 하는 일: analysis/backtest.ts, validationReport.ts 테스트 (롤링 원점, holdout 한 번 평가, 누수 방지, 재현성).
 * 입력: 알려진 계수로 만든 합성 매출 (실제 아님, 결정적 난수)
 * 출력: 테스트 통과/실패
 * 주의점: 누수 테스트는 "나중 데이터를 바꿔도 앞선 예측이 그대로인가"를 봅니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFeatures } from '../../analysis/features'
import { runBacktest, type BacktestPoint } from '../../analysis/backtest'
import { buildValidationReport } from '../../analysis/validationReport'
import { seededRandom } from '../../analysis/bootstrap'
import type { DailyWeather, SalesInputRow } from '../../analysis/types'

const DOW = [0, 0.05, 0.02, 0, -0.03, 0.04, 0.1]

function synthetic(days: number, seed: number, salesShift: (i: number) => number = () => 0) {
  const rand = seededRandom(seed)
  const sales: SalesInputRow[] = []
  const weather: DailyWeather[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    const precip = rand() < 0.7 ? 0 : 2 + rand() * 15
    const temp = 5 + rand() * 25
    const band = precip >= 10 ? -0.5 : precip >= 0.1 ? -0.2 : 0
    const y = Math.exp(13 + DOW[dow]! + band + 0.02 * temp + (rand() - 0.5) * 0.1) + salesShift(i)
    sales.push({ row: i + 2, date, sales: y, transactions: null, iceSales: null, hotSales: null, flags: [] })
    weather.push({ date, precipMm: precip, tempAvg: temp, tempMax: temp, tempMin: temp, windMs: null })
  }
  return { sales, weather }
}

const LAST = '2026-02-04' // 2025-01-01 + 399일 = 400번째 날

test('롤링 원점: 첫 예측은 유효 영업일 56번째 이후이고, holdout은 마지막 28일이다', () => {
  const { sales, weather } = synthetic(400, 1)
  const rows = buildFeatures({ sales, weather, events: [] }, LAST)
  const points = runBacktest(rows)
  assert.equal(points[0]!.date, rows[56]!.date)
  assert.equal(points.filter((p) => p.holdout).length, 28)
  assert.equal(points.length, 400 - 56)
})

test('누수 방지: 뒤쪽 매출을 바꿔도 앞쪽 날짜의 M1 예측은 그대로다', () => {
  const base = synthetic(400, 2)
  const rowsA = buildFeatures({ sales: base.sales, weather: base.weather, events: [] }, LAST)
  const cutDate = rowsA[350]!.date
  const changed = synthetic(400, 2, (i) => (i >= 350 ? 500000 : 0))
  const rowsB = buildFeatures({ sales: changed.sales, weather: changed.weather, events: [] }, LAST)
  const a = runBacktest(rowsA).filter((p) => p.date < cutDate)
  const b = runBacktest(rowsB).filter((p) => p.date < cutDate)
  assert.deepEqual(a.map((p) => p.m1), b.map((p) => p.m1))
})

test('holdout은 한 번만 평가: holdout 실제값을 바꿔도 holdout 예측은 그대로다', () => {
  const base = synthetic(400, 3)
  const rowsA = buildFeatures({ sales: base.sales, weather: base.weather, events: [] }, LAST)
  const changed = synthetic(400, 3, (i) => (i >= 380 ? 300000 : 0))
  const rowsB = buildFeatures({ sales: changed.sales, weather: changed.weather, events: [] }, LAST)
  const ha = runBacktest(rowsA).filter((p) => p.holdout)
  const hb = runBacktest(rowsB).filter((p) => p.holdout)
  assert.deepEqual(ha.map((p) => p.m1), hb.map((p) => p.m1))
  assert.notDeepEqual(ha.map((p) => p.actual), hb.map((p) => p.actual))
})

test('같은 입력이면 백테스트 결과와 검증 리포트가 같다 (재현성)', () => {
  const { sales, weather } = synthetic(400, 4)
  const rows = buildFeatures({ sales, weather, events: [] }, LAST)
  const p1: BacktestPoint[] = runBacktest(rows)
  const p2: BacktestPoint[] = runBacktest(rows)
  assert.deepEqual(p1, p2)
  assert.deepEqual(buildValidationReport(p1), buildValidationReport(p2))
})

test('검증 리포트: 판정은 holdout 기준이고 입력 출처는 관측 기반이다', () => {
  const { sales, weather } = synthetic(400, 5)
  const rows = buildFeatures({ sales, weather, events: [] }, LAST)
  const report = buildValidationReport(runBacktest(rows))
  assert.equal(report.inputSource, 'observed_only')
  assert.equal(report.holdout.n, 28)
  assert.ok(report.comparison.n > 0)
  assert.ok(['adopt', 'hold', 'reject'].includes(report.comparison.verdict as string))
})
