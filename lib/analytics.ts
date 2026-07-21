/**
 * Pure analytics module — no I/O.
 * Input : SalesRow[] + DailyPoint[] (joined by date)
 * Output: StoreAnalytics
 */

import type { DailyPoint } from './weather'

// ── Input ────────────────────────────────────────────────────────────────────

export interface SalesRow {
  date: string
  storeId: string
  storeName: string
  totalSales: number
  iceSales: number
  hotSales: number
  transactions: number
}

// ── Output ───────────────────────────────────────────────────────────────────

export interface Correlations {
  salesVsTemp: number          // Pearson r: total_sales × tempMax
  salesVsPrecip: number        // Pearson r: total_sales × precip  (expect negative)
  iceRatioVsTemp: number       // Pearson r: ice_ratio  × tempMax  (expect strong positive)
  salesVsApparentTemp: number  // Pearson r: total_sales × apparentTempMax
}

export interface DowRow {
  dow: number        // 0=Sun … 6=Sat
  label: string      // '일'~'토'
  avgSales: number
  index: number      // avgSales / overallMean  (1.15 = +15%)
  count: number
}

export interface OutlierRow {
  date: string
  totalSales: number
  zScore: number     // (sales - mean) / std
  tempMax: number
  precip: number
  tags: string[]     // ['폭우', '폭염', '주말', '기록적 매출', ...]
}

export interface ScatterPoint {
  date: string
  dow: number
  totalSales: number
  iceSales: number
  hotSales: number
  transactions: number
  tempMax: number
  tempMin: number
  precip: number
  apparentTempMax: number
  iceRatio: number   // iceSales / totalSales
}

export interface StoreAnalytics {
  storeId: string
  storeName: string
  period: { start: string; end: string; days: number }
  summary: {
    avgDailySales: number
    maxDailySales: number
    minDailySales: number
    totalRevenue: number
  }
  correlations: Correlations
  dowEffect: DowRow[]
  outliers: OutlierRow[]
  scatter: ScatterPoint[]   // full joined dataset — used by charts and GPT context
}

// ── Math ─────────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function populationStd(xs: number[], xm: number): number {
  return Math.sqrt(xs.reduce((s, x) => s + (x - xm) ** 2, 0) / xs.length)
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const xm = mean(xs)
  const ym = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i]! - ym), 0)
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - xm) ** 2, 0) *
    ys.reduce((s, y) => s + (y - ym) ** 2, 0),
  )
  return den === 0 ? 0 : +(num / den).toFixed(4)
}

// ── Core ─────────────────────────────────────────────────────────────────────

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function computeStoreAnalytics(
  sales: SalesRow[],
  weather: DailyPoint[],
): StoreAnalytics {
  const wxMap = new Map(weather.map((d) => [d.date, d]))

  // Inner join on date
  const joined: ScatterPoint[] = []
  for (const row of sales) {
    const wx = wxMap.get(row.date)
    if (!wx) continue
    joined.push({
      date:            row.date,
      dow:             new Date(row.date).getDay(),
      totalSales:      row.totalSales,
      iceSales:        row.iceSales,
      hotSales:        row.hotSales,
      transactions:    row.transactions,
      tempMax:         wx.tempMax,
      tempMin:         wx.tempMin,
      precip:          wx.precip,
      apparentTempMax: wx.apparentTempMax,
      iceRatio:        row.totalSales > 0 ? +(row.iceSales / row.totalSales).toFixed(4) : 0,
    })
  }

  if (joined.length === 0) {
    throw new Error(`No date overlap between sales (${sales.length} rows) and weather (${weather.length} days)`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const salesArr = joined.map((r) => r.totalSales)
  const avgDaily = mean(salesArr)

  const summary = {
    avgDailySales: Math.round(avgDaily),
    maxDailySales: Math.max(...salesArr),
    minDailySales: Math.min(...salesArr),
    totalRevenue:  salesArr.reduce((a, b) => a + b, 0),
  }

  // ── Correlations ───────────────────────────────────────────────────────────
  const correlations: Correlations = {
    salesVsTemp:         pearson(joined.map((r) => r.tempMax),         salesArr),
    salesVsPrecip:       pearson(joined.map((r) => r.precip),          salesArr),
    iceRatioVsTemp:      pearson(joined.map((r) => r.tempMax),         joined.map((r) => r.iceRatio)),
    salesVsApparentTemp: pearson(joined.map((r) => r.apparentTempMax), salesArr),
  }

  // ── Day-of-week effect ─────────────────────────────────────────────────────
  const dowEffect: DowRow[] = DOW_LABELS.map((label, dow) => {
    const vals = joined.filter((r) => r.dow === dow).map((r) => r.totalSales)
    const avg  = vals.length > 0 ? Math.round(mean(vals)) : 0
    return {
      dow,
      label,
      avgSales: avg,
      index:    avgDaily > 0 ? +(avg / avgDaily).toFixed(3) : 1,
      count:    vals.length,
    }
  })

  // ── Outliers (|z| > 2, top 10 by severity) ────────────────────────────────
  const salesStd = populationStd(salesArr, avgDaily)
  const outliers: OutlierRow[] = joined
    .map((r) => {
      const z = salesStd > 0 ? (r.totalSales - avgDaily) / salesStd : 0
      return { r, z }
    })
    .filter(({ z }) => Math.abs(z) > 2)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 10)
    .map(({ r, z }) => {
      const tags: string[] = []
      if (r.precip >= 20)      tags.push('폭우')
      else if (r.precip >= 5)  tags.push('강우')
      if (r.tempMax >= 33)     tags.push('폭염')
      else if (r.tempMax <= 0) tags.push('한파')
      if (r.dow === 0 || r.dow === 6) tags.push('주말')
      tags.push(z > 0 ? '기록적 매출' : '급격한 매출 감소')
      return {
        date:       r.date,
        totalSales: r.totalSales,
        zScore:     +z.toFixed(2),
        tempMax:    r.tempMax,
        precip:     r.precip,
        tags,
      }
    })

  // ── Period ─────────────────────────────────────────────────────────────────
  const dates = joined.map((r) => r.date).sort()

  return {
    storeId:   sales[0]?.storeId   ?? '',
    storeName: sales[0]?.storeName ?? '',
    period:    { start: dates[0]!, end: dates.at(-1)!, days: joined.length },
    summary,
    correlations,
    dowEffect,
    outliers,
    scatter: joined,
  }
}
