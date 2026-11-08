/**
 * 이 파일이 하는 일: analysis/pipeline.ts와 weatherInput.ts 테스트 (끝까지 실행, 표본 부족, 날씨 파일 읽기).
 * 입력: tests/fixtures/synthetic/synthetic_pipeline_*_400d.csv (합성 데이터, 실제 아님)
 * 출력: 테스트 통과/실패
 * 주의점: 합성 데이터는 모델이 가정한 규칙대로 만들었으므로 "adopt"는 시스템 동작 확인일 뿐 실제 효과의 증거가 아닙니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ingestSalesCsv } from '../../analysis/ingest'
import { configureLogger } from '../../analysis/logger'
import { runPipeline } from '../../analysis/pipeline'
import { parseWeatherCsv } from '../../analysis/weatherInput'
import type { ColumnMapping, SalesInputRow } from '../../analysis/types'

const MAP: ColumnMapping = { date: 'date', sales: 'sales', transactions: 'transactions', iceSales: 'ice_sales', hotSales: 'hot_sales' }

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', 'synthetic', name), 'utf-8')
}

test('끝까지 실행: 합성 400일 입력으로 리포트, 판정, 목표일 예측이 나온다', () => {
  configureLogger({ runId: 'pipe-test', sink: () => {} })
  const ingest = ingestSalesCsv(fixture('synthetic_pipeline_sales_400d.csv'), MAP)
  assert.equal(ingest.ok, true)
  const weather = parseWeatherCsv(fixture('synthetic_pipeline_weather_400d.csv'))
  assert.equal(weather.errors.length, 0)
  const r = runPipeline({ storeCode: 'CAFE-A', sales: ingest.rows, weather: weather.rows, events: [] })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.cutoff, '2026-02-04')
  assert.equal(r.prediction.targetDate, '2026-02-05')
  assert.equal(r.prediction.status, 'forecast_unavailable') // 목표일 예보가 없으므로 기준선만
  assert.equal(r.prediction.expectedSales, null)
  assert.ok(r.prediction.baselineSales !== null)
  assert.equal(r.report.holdout.n, 28)
  assert.ok(['adopt', 'hold', 'reject'].includes(r.report.comparison.verdict as string))
})

test('목표일 예보를 주면 상태가 ok이고 예측값이 나온다', () => {
  configureLogger({ runId: 'pipe-test', sink: () => {} })
  const ingest = ingestSalesCsv(fixture('synthetic_pipeline_sales_400d.csv'), MAP)
  const weather = parseWeatherCsv(fixture('synthetic_pipeline_weather_400d.csv'))
  const r = runPipeline({
    storeCode: 'CAFE-A', sales: ingest.rows, weather: weather.rows, events: [],
    targetForecast: { date: '2026-02-05', precipMm: 0, tempAvg: 15, tempMax: 18, tempMin: 12, windMs: null },
  })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.prediction.status, 'ok')
  assert.ok(r.prediction.expectedSales !== null && r.prediction.expectedSales > 0)
})

test('표본이 56일보다 적으면 리포트를 만들지 않는다 (insufficient_data)', () => {
  const sales: SalesInputRow[] = Array.from({ length: 30 }, (_, i) => ({
    row: i + 2, date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    sales: 1000, transactions: null, iceSales: null, hotSales: null, flags: [],
  }))
  const r = runPipeline({ storeCode: 'CAFE-A', sales, weather: [], events: [] })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.reason, 'insufficient_data')
})

test('날씨 CSV: 열이 빠지면 오류, 날짜가 틀리면 그 줄만 건너뛴다', () => {
  const missing = parseWeatherCsv('date,precipMm\n2026-01-01,0\n')
  assert.equal(missing.errors[0]!.code, 'E_CSV_PARSE')
  const bad = parseWeatherCsv('date,precipMm,tempAvg,tempMax,tempMin,windMs\n2026-02-30,0,1,2,0,\n2026-03-01,0,1,2,0,\n')
  assert.equal(bad.rows.length, 1)
  assert.equal(bad.errors[0]!.code, 'E_BAD_DATE')
})
