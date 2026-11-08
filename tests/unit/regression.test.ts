/**
 * 이 파일이 하는 일: analysis/ols.ts, analysis/regression.ts 테스트 (행렬 풀이, 계수 복원, 랭크 부족, smearing).
 * 입력: 알려진 계수로 만든 합성 매출 (실제 아님, 결정적 난수 사용)
 * 출력: 테스트 통과/실패
 * 주의점: 계수를 "정확히" 맞추는 것이 아니라, 정해 둔 계수의 부호와 크기를 허용 범위 안에서 맞추는지 확인합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { solveNormal } from '../../analysis/ols'
import { buildFeatures } from '../../analysis/features'
import { trainM1, predictM1, effectsPct, designRow, M1_COLUMNS } from '../../analysis/regression'
import type { DailyWeather, FeatureRow, SalesInputRow } from '../../analysis/types'

/** 결정적 난수 (Mulberry32). 같은 시드면 같은 값이 나옵니다. */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DOW_EFFECT = [0, 0.05, 0.02, 0, -0.03, 0.04, 0.1] // 일~토 (일요일 기준)
const TRUE = { light: -0.2, heavy: -0.5, temp: 0.02 }

/** 알려진 계수로 합성 매출과 날씨를 만듭니다. */
function synthetic(days: number, seed: number, allowHeavy: boolean): { sales: SalesInputRow[]; weather: DailyWeather[] } {
  const rand = rng(seed)
  const sales: SalesInputRow[] = []
  const weather: DailyWeather[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    const u = rand()
    const precip = u < 0.6 ? 0 : u < 0.9 ? 2 + rand() * 6 : allowHeavy ? 12 + rand() * 18 : 0
    const temp = 5 + rand() * 25
    const band = precip >= 10 ? TRUE.heavy : precip >= 0.1 ? TRUE.light : 0
    const noise = (rand() - 0.5) * 0.1
    const y = Math.exp(13 + DOW_EFFECT[dow]! + band + TRUE.temp * temp + noise)
    sales.push({ row: i + 2, date, sales: y, transactions: null, iceSales: null, hotSales: null, flags: [] })
    weather.push({ date, precipMm: precip, tempAvg: temp, tempMax: temp, tempMin: temp, windMs: null })
  }
  return { sales, weather }
}

test('연립방정식 풀이: 2원 방정식을 맞게 푼다 (x=1, y=2)', () => {
  // [2 1; 1 3] [x; y] = [4; 7]  →  x = 1, y = 2
  const r = solveNormal([[2, 1], [1, 3]], [4, 7], 0)
  assert.ok(Math.abs((r.beta[0] as number) - 1) < 1e-9)
  assert.ok(Math.abs((r.beta[1] as number) - 2) < 1e-9)
  assert.deepEqual(r.dropped, [])
})

test('두 열이 같은 정보면 한 열을 빼고 기록한다 (랭크 부족)', () => {
  const X = [[1, 2, 2], [1, 3, 3], [1, 4, 4], [1, 5, 5]] // 3번째 열 = 2번째 열
  const y = [1, 2, 3, 4]
  const r = solveNormal(X, y, 1e-8)
  assert.equal(r.dropped.length, 1)
  assert.ok(r.beta[r.dropped[0]!] === null)
})

test('합성 데이터에서 날씨 계수의 부호와 크기를 복원한다 (M1)', () => {
  const { sales, weather } = synthetic(400, 42, true)
  const rows = buildFeatures({ sales, weather, events: [] }, '2026-02-04')
  const model = trainM1(rows, '2026-02-04')
  assert.ok(Math.abs(model.beta.rain_light - TRUE.light) < 0.03, `light ${model.beta.rain_light}`)
  assert.ok(Math.abs(model.beta.rain_heavy - TRUE.heavy) < 0.1, `heavy ${model.beta.rain_heavy}`)
  assert.ok(Math.abs(model.beta.temp - TRUE.temp) < 0.003, `temp ${model.beta.temp}`)
  assert.ok(model.beta.rain_light < 0 && model.beta.rain_heavy < model.beta.rain_light) // 부호와 순서
  const e = effectsPct(model)
  assert.ok(e.rainHeavy < e.rainLight && e.rainLight < 0)
})

test('강한 비가 한 번도 없으면 rain_heavy를 빼고 기록한다', () => {
  const { sales, weather } = synthetic(400, 7, false)
  const rows = buildFeatures({ sales, weather, events: [] }, '2026-02-04')
  const model = trainM1(rows, '2026-02-04')
  assert.ok(model.dropped.includes('rain_heavy'))
  assert.equal(model.beta.rain_heavy, 0)
})

test('smearing 보정은 1 근처이고 예측값은 양수이다', () => {
  const { sales, weather } = synthetic(400, 99, true)
  const rows = buildFeatures({ sales, weather, events: [] }, '2026-02-04')
  const model = trainM1(rows, '2026-02-04')
  assert.ok(model.smearing > 1 && model.smearing < 1.05, `smearing ${model.smearing}`)
  const sample = rows.find((r) => r.rainBand === 'none') as FeatureRow
  const p = predictM1(model, sample)
  assert.ok(p !== null && p > 0)
})

test('같은 날씨에서 비가 많이 올수록 예측 매출이 낮다', () => {
  const { sales, weather } = synthetic(400, 5, true)
  const rows = buildFeatures({ sales, weather, events: [] }, '2026-02-04')
  const model = trainM1(rows, '2026-02-04')
  const base = rows.find((r) => r.rainBand === 'none' && r.dow === 3)!
  const heavy = { ...base, rainBand: 'heavy' as const }
  const light = { ...base, rainBand: 'light' as const }
  assert.ok(predictM1(model, heavy)! < predictM1(model, light)! && predictM1(model, light)! < predictM1(model, base)!)
})

test('설계 행은 M1 열 개수와 같다', () => {
  const r = { date: '2026-01-01', y: 1, dow: 2, isHoliday: false, isClosed: false, isPromo: false, rainBand: 'light', tempAvg: 10, tempMax: 10, tempMin: 10, trendIdx: 0.5, weatherSource: 'observed', flags: [] } as FeatureRow
  assert.equal(designRow(r).length, M1_COLUMNS.length)
})
