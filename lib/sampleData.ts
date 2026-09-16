/**
 * Synthetic sample sales data — generated on demand for the same rolling
 * date window used by lib/weather.ts (getRollingArchiveRange), instead of
 * shipping a static CSV that goes stale. Reuses getAllStoresWeather() so no
 * extra Open-Meteo calls are made — the weather archive is already fetched
 * (and file-cached) for the same window.
 *
 * Correlation rules (kept identical to the original scripts/generate-sample-data.ts):
 *   - temp >= 30°C        → ice ratio +40%  (calcIceRatio)
 *   - precip >= 5mm       → total_sales -20%
 *   - precip >= 2mm       → total_sales -8%
 *   - weekend (Sat/Sun)   → total_sales +15%
 *   - seeded per date+store index → deterministic for a given day, no re-roll on every request
 */

import { getAllStoresWeather, type DailyPoint } from './weather'
import { STORES } from './stores'

const BASELINES: Record<string, number> = {
  gangnam: 850_000,
  hongdae: 720_000,
  pangyo: 680_000,
  haeundae: 590_000,
  jeju: 510_000,
}

export interface SampleSalesRow {
  date: string
  store_id: string
  store_name: string
  lat: number
  lon: number
  total_sales: number
  ice_sales: number
  hot_sales: number
  transactions: number
}

// ── Seeded PRNG (Mulberry32) — deterministic per date+store ───────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Ice-to-total ratio rises with temperature (+40% of base at 30°C+). */
function calcIceRatio(tempMax: number): number {
  const base = 0.3
  const tempSlope = Math.max(0, (tempMax - 15) * 0.008)
  const heatBump = tempMax >= 30 ? base * 0.4 : 0
  return Math.min(0.8, base + tempSlope + heatBump)
}

function generateSalesForDay(
  baseline: number,
  day: DailyPoint,
  storeIdx: number,
): { totalSales: number; iceSales: number; hotSales: number; transactions: number } {
  const rng = mulberry32(parseInt(day.date.replace(/-/g, '')) * 31 + storeIdx * 9_999)
  const dow = new Date(day.date).getDay() // 0=Sun, 6=Sat

  let total = baseline
  if (dow === 0 || dow === 6) total *= 1.15
  if (day.precip >= 5) total *= 0.8
  else if (day.precip >= 2) total *= 0.92
  total *= 0.85 + rng() * 0.3
  total = Math.round(total)

  const iceRatio = calcIceRatio(day.tempMax)
  const iceSales = Math.round(total * iceRatio)
  const hotSales = total - iceSales
  const transactions = Math.max(10, Math.round(total / 4_800 + rng() * 8))

  return { totalSales: total, iceSales, hotSales, transactions }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateSampleSalesRows(): Promise<SampleSalesRow[]> {
  const weatherByStore = await getAllStoresWeather()
  const rows: SampleSalesRow[] = []

  weatherByStore.forEach((wx, i) => {
    const store = STORES.find((s) => s.id === wx.storeId)
    if (!store) return
    const baseline = BASELINES[store.id] ?? 600_000

    for (const day of wx.archive) {
      const s = generateSalesForDay(baseline, day, i)
      rows.push({
        date: day.date,
        store_id: store.id,
        store_name: store.name,
        lat: store.lat,
        lon: store.lon,
        total_sales: s.totalSales,
        ice_sales: s.iceSales,
        hot_sales: s.hotSales,
        transactions: s.transactions,
      })
    }
  })

  return rows
}

export function rowsToCsv(rows: SampleSalesRow[]): string {
  const header = 'date,store_id,store_name,lat,lon,total_sales,ice_sales,hot_sales,transactions'
  const lines = rows.map((r) =>
    [r.date, r.store_id, r.store_name, r.lat, r.lon, r.total_sales, r.ice_sales, r.hot_sales, r.transactions].join(','),
  )
  return [header, ...lines].join('\n')
}
