import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'papaparse'
import { getStoreWeather } from '@/lib/weather'
import { computeStoreAnalytics, type SalesRow } from '@/lib/analytics'
import { STORES } from '@/lib/stores'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── CSV helpers ───────────────────────────────────────────────────────────────

interface CsvRow {
  date: string
  store_id: string
  store_name: string
  lat: string
  lon: string
  total_sales: string
  ice_sales: string
  hot_sales: string
  transactions: string
}

function parseSalesRow(r: CsvRow): SalesRow {
  return {
    date:         r.date,
    storeId:      r.store_id,
    storeName:    r.store_name,
    totalSales:   parseInt(r.total_sales),
    iceSales:     parseInt(r.ice_sales),
    hotSales:     parseInt(r.hot_sales),
    transactions: parseInt(r.transactions),
  }
}

function loadSampleCsv(): SalesRow[] {
  const csv = readFileSync(join(process.cwd(), 'public', 'sample-data.csv'), 'utf-8')
  const { data } = parse<CsvRow>(csv, { header: true, skipEmptyLines: true })
  return data.map(parseSalesRow)
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    const allSales = loadSampleCsv()

    if (storeId) {
      const storeSales = allSales.filter((r) => r.storeId === storeId)
      const wx         = await getStoreWeather(storeId)
      const analytics  = computeStoreAnalytics(storeSales, wx.archive)
      return NextResponse.json(analytics)
    }

    const results = await Promise.all(
      STORES.map(async (store) => {
        const storeSales = allSales.filter((r) => r.storeId === store.id)
        const wx         = await getStoreWeather(store.id)
        return computeStoreAnalytics(storeSales, wx.archive)
      }),
    )
    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
