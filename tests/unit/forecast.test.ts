/**
 * 이 파일이 하는 일: analysis/status.ts, forecast.ts, recommend.ts 테스트 (상태 코드, 예보 없음, 구간 부족, 참고 제안).
 * 입력: 합성 매출과 날씨 (실제 아님), 손으로 만든 예측 객체
 * 출력: 테스트 통과/실패
 * 주의점: 상태 문구는 방법론 §10 문장과 글자 단위로 같아야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFeatures } from '../../analysis/features'
import { trainM1 } from '../../analysis/regression'
import { predictTarget, type Prediction } from '../../analysis/forecast'
import { evaluateStatus, STATUS_TEXT, type StatusInput } from '../../analysis/status'
import { recommend } from '../../analysis/recommend'
import { seededRandom } from '../../analysis/bootstrap'
import type { DailyWeather, SalesInputRow } from '../../analysis/types'

const DOW = [0, 0.05, 0.02, 0, -0.03, 0.04, 0.1]

/** heavyDays: 강한 비가 내리는 날 수 (0이면 한 번도 안 옴). */
function data(days: number, heavyDays: number) {
  const rand = seededRandom(11)
  const sales: SalesInputRow[] = []
  const weather: DailyWeather[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    const heavy = i >= 100 && i < 100 + heavyDays // 강한 비는 정확히 heavyDays일
    const precip = heavy ? 15 : rand() < 0.6 ? 0 : 2 + rand() * 6
    const temp = 5 + rand() * 25
    const band = precip >= 10 ? -0.5 : precip >= 0.1 ? -0.2 : 0
    const y = Math.exp(13 + DOW[dow]! + band + 0.02 * temp + (rand() - 0.5) * 0.1)
    sales.push({ row: i + 2, date, sales: y, transactions: null, iceSales: null, hotSales: null, flags: [] })
    weather.push({ date, precipMm: precip, tempAvg: temp, tempMax: temp, tempMin: temp, windMs: null })
  }
  return { sales, weather }
}

const CUT = '2026-02-04'
const TARGET_DATE = '2026-02-05'

test('상태 문구는 방법론 §10 문장과 같다', () => {
  assert.equal(STATUS_TEXT.insufficient_data, '데이터가 부족해 예측을 만들지 않았습니다.')
  assert.equal(STATUS_TEXT.forecast_unavailable, '이 날짜는 날씨 예보 없이 기준선으로만 계산했습니다.')
  assert.equal(STATUS_TEXT.stale_weather, '날씨 데이터 갱신이 지연되어 이전 자료를 사용했습니다.')
})

const okInput: StatusInput = {
  trainDays: 365, rainDays: 100, bandDays: { light: 50, heavy: 20 }, weatherMissingRatio: 0,
  forecastPrecipKnown: true, staleWeather: false, targetRainBand: 'light',
}

test('상태: 표본과 날씨가 충분하면 ok', () => {
  assert.equal(evaluateStatus(okInput).code, 'ok')
})

test('상태: 학습 일수가 56일 미만이면 insufficient_data', () => {
  assert.equal(evaluateStatus({ ...okInput, trainDays: 55 }).code, 'insufficient_data')
})

test('상태: 날씨 결측이 5%를 넘으면 missing_weather', () => {
  assert.equal(evaluateStatus({ ...okInput, weatherMissingRatio: 0.06 }).code, 'missing_weather')
})

test('상태: 목표일 구간 표본이 8일 미만이면 insufficient_band', () => {
  assert.equal(evaluateStatus({ ...okInput, targetRainBand: 'heavy', bandDays: { light: 50, heavy: 7 } }).code, 'insufficient_band')
})

test('예보 강수가 없으면 forecast_unavailable이고, 예측값은 비우고 기준선만 낸다', () => {
  const { sales, weather } = data(400, 0)
  const rows = buildFeatures({ sales, weather, events: [] }, CUT)
  const model = trainM1(rows, CUT)
  const p = predictTarget(rows, model, CUT, { date: TARGET_DATE, weather: { date: TARGET_DATE, precipMm: null, tempAvg: 15, tempMax: 15, tempMin: 15, windMs: null }, events: [] })
  assert.equal(p.status, 'forecast_unavailable')
  assert.equal(p.expectedSales, null)
  assert.notEqual(p.baselineSales, null)
  assert.equal(p.statusText, STATUS_TEXT.forecast_unavailable)
})

test('충분한 데이터와 예보가 있으면 ok이고 예측값과 변화율을 낸다', () => {
  const { sales, weather } = data(400, 0)
  const rows = buildFeatures({ sales, weather, events: [] }, CUT)
  const model = trainM1(rows, CUT)
  const p = predictTarget(rows, model, CUT, { date: TARGET_DATE, weather: { date: TARGET_DATE, precipMm: 0, tempAvg: 15, tempMax: 15, tempMin: 15, windMs: null }, events: [] })
  assert.equal(p.status, 'ok')
  assert.ok(p.expectedSales !== null && p.expectedSales > 0)
  assert.ok(p.changeRatePct !== null)
  assert.equal(p.sourceNote, 'observed_only')
})

test('강한 비 표본이 8일 미만이면 목표일이 강한 비여도 insufficient_band이고 강수 효과는 출력하지 않는다', () => {
  const { sales, weather } = data(400, 3)
  const rows = buildFeatures({ sales, weather, events: [] }, CUT)
  const model = trainM1(rows, CUT)
  const p = predictTarget(rows, model, CUT, { date: TARGET_DATE, weather: { date: TARGET_DATE, precipMm: 20, tempAvg: 15, tempMax: 15, tempMin: 15, windMs: null }, events: [] })
  assert.equal(p.status, 'insufficient_band')
  assert.ok(!p.factors.some((f) => f.name === 'rain_heavy'))
})

test('참고 제안: 모델이 ok이고 예상 매출이 기준선의 95% 미만이면 준비량 비교 문구 (근거: model_supported)', () => {
  const p: Prediction = {
    targetDate: TARGET_DATE, modelVersion: '1.0.0', expectedSales: 80, baselineSales: 100, changeRatePct: -20,
    status: 'ok', statusText: '', factors: [], sampleSize: 200, sourceNote: 'observed_only',
  }
  const r = recommend(p)
  assert.ok(r.some((x) => x.text === '준비량을 과거 비 오는 날과 비교해 볼 수 있어요.' && x.evidence === 'model_supported' && x.sampleSize === 200))
})

test('참고 제안: 모델 상태가 ok가 아니면 축소 문구를 내지 않는다', () => {
  const p: Prediction = {
    targetDate: TARGET_DATE, modelVersion: '1.0.0', expectedSales: null, baselineSales: 100, changeRatePct: null,
    status: 'forecast_unavailable', statusText: '', factors: [], sampleSize: 200, sourceNote: 'observed_only',
  }
  assert.equal(recommend(p).some((x) => x.evidence === 'model_supported'), false)
})
