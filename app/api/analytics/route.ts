import { NextResponse } from 'next/server'
import { getStoreWeather } from '@/lib/weather'
import { computeStoreAnalytics, type SalesRow } from '@/lib/analytics'
import { generateSampleSalesRows, type SampleSalesRow } from '@/lib/sampleData'
import { STORES } from '@/lib/stores'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── Sample sales (dynamic, rolling window — see lib/sampleData.ts) ────────────

function toSalesRow(r: SampleSalesRow): SalesRow {
  return {
    date:         r.date,
    storeId:      r.store_id,
    storeName:    r.store_name,
    totalSales:   r.total_sales,
    iceSales:     r.ice_sales,
    hotSales:     r.hot_sales,
    transactions: r.transactions,
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    const allSales = (await generateSampleSalesRows()).map(toSalesRow)

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
