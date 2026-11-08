/**
 * 이 파일이 하는 일: M1 검산용 입력을 내보냅니다 (제품 코드 아님).
 * 출력: tests/verify/m1_design.csv (설계 행렬과 log 매출), tests/verify/m1_ts_coef.json (TypeScript가 푼 계수)
 * 주의점: 합성 데이터만 씁니다. 실제 매출은 쓰지 않습니다.
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { buildFeatures } from '../../analysis/features'
import { trainM1, trainingRows, designRow, M1_COLUMNS } from '../../analysis/regression'
import type { DailyWeather, SalesInputRow } from '../../analysis/types'

function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const DOW = [0, 0.05, 0.02, 0, -0.03, 0.04, 0.1]
const sales: SalesInputRow[] = []
const weather: DailyWeather[] = []
const rand = rng(42)
for (let i = 0; i < 400; i++) {
  const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const u = rand()
  const precip = u < 0.6 ? 0 : u < 0.9 ? 2 + rand() * 6 : 12 + rand() * 18
  const temp = 5 + rand() * 25
  const band = precip >= 10 ? -0.5 : precip >= 0.1 ? -0.2 : 0
  const y = Math.exp(13 + DOW[dow]! + band + 0.02 * temp + (rand() - 0.5) * 0.1)
  sales.push({ row: i + 2, date, sales: y, transactions: null, iceSales: null, hotSales: null, flags: [] })
  weather.push({ date, precipMm: precip, tempAvg: temp, tempMax: temp, tempMin: temp, windMs: null })
}
const cutoff = '2026-02-04'
const rows = buildFeatures({ sales, weather, events: [] }, cutoff)
const train = trainingRows(rows, cutoff)
const header = ['date', 'logy', ...M1_COLUMNS].join(',')
const lines = train.map((r) => [r.date, Math.log(r.y as number), ...designRow(r)].join(','))
writeFileSync(join('tests', 'verify', 'm1_design.csv'), [header, ...lines].join('\n') + '\n', 'utf-8')
const model = trainM1(rows, cutoff)
writeFileSync(join('tests', 'verify', 'm1_ts_coef.json'), JSON.stringify({ beta: model.beta, dropped: model.dropped, n: model.n }, null, 2), 'utf-8')
console.log('exported', train.length, 'rows; dropped:', model.dropped.join(',') || 'none')
