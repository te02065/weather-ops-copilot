'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { parse } from 'papaparse'
import { computeStoreAnalytics, type SalesRow, type StoreAnalytics } from '@/lib/analytics'
import type { StoreWeather } from '@/lib/weather'
import UploadSection        from '@/components/UploadSection'
import CorrelationBadges    from '@/components/CorrelationBadges'
import WeatherScatterCharts from '@/components/WeatherScatterCharts'
import DowBarChart          from '@/components/DowBarChart'
import SalesTimeline        from '@/components/SalesTimeline'
import ReportSection        from '@/components/ReportSection'

// Leaflet is browser-only — must be dynamically imported with ssr: false
const StoreMap = dynamic(() => import('@/components/StoreMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Loading map…
    </div>
  ),
})

// ── CSV parsing ───────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [analytics,  setAnalytics]  = useState<StoreAnalytics[] | null>(null)
  const [weather,    setWeather]    = useState<StoreWeather[]   | null>(null)
  const [selectedId, setSelectedId] = useState('gangnam')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function processData(csvText: string) {
    setLoading(true)
    setError(null)
    try {
      // 1. Parse CSV
      const { data, errors } = parse<CsvRow>(csvText, { header: true, skipEmptyLines: true })
      if (errors.length && data.length === 0)
        throw new Error('CSV parse error: ' + errors[0]?.message)
      const sales = data.map(parseSalesRow)

      // 2. Fetch weather for all stores (server-side file cache TTL 24h / 1h)
      const wxRes = await fetch('/api/weather')
      if (!wxRes.ok) throw new Error(`Weather API error: ${wxRes.status}`)
      const wxData = (await wxRes.json()) as StoreWeather[]
      setWeather(wxData)

      // 3. Compute analytics client-side (pure math)
      const result = wxData.map((wx) => {
        const storeSales = sales.filter((s) => s.storeId === wx.storeId)
        return computeStoreAnalytics(storeSales, wx.archive)
      })
      setAnalytics(result)
      setSelectedId(result[0]?.storeId ?? 'gangnam')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data processing error')
    } finally {
      setLoading(false)
    }
  }

  async function loadSample() {
    const res = await fetch('/sample-data.csv')
    if (!res.ok) throw new Error('Failed to load sample CSV')
    await processData(await res.text())
  }

  const sel   = analytics?.find((a) => a.storeId === selectedId)
  const selWx = weather?.find((w) => w.storeId === selectedId)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌤️</span>
            <div>
              <h1 className="text-base font-bold leading-tight">Weather-Driven Ops Copilot</h1>
              <p className="text-xs text-slate-400">Sales × Weather Analytics &amp; 7-Day Briefing</p>
            </div>
          </div>
          {analytics && (
            <button
              onClick={() => { setAnalytics(null); setWeather(null) }}
              className="text-xs text-slate-400 hover:text-slate-700 transition"
            >
              ↩ Upload new file
            </button>
          )}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!analytics ? (
          <UploadSection
            onUpload={processData}
            onSample={loadSample}
            loading={loading}
            error={error}
          />
        ) : (
          <>
            {/* Row 1: Map + Store Selector */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <StoreMap
                  analytics={analytics}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Select Store</h2>
                {analytics.map((a) => {
                  const active = a.storeId === selectedId
                  return (
                    <button
                      key={a.storeId}
                      onClick={() => setSelectedId(a.storeId)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{a.storeName}</div>
                      <div className={`text-xs mt-0.5 ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                        Avg ₩{a.summary.avgDailySales.toLocaleString()}
                        &nbsp;·&nbsp;Precip r={a.correlations.salesVsPrecip}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {sel && (
              <>
                {/* Row 2: Correlation badges */}
                <CorrelationBadges correlations={sel.correlations} />

                {/* Row 3: Scatter charts */}
                <WeatherScatterCharts
                  scatter={sel.scatter}
                  correlations={sel.correlations}
                />

                {/* Row 4: DOW chart + Sales timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DowBarChart dowEffect={sel.dowEffect} />
                  <SalesTimeline scatter={sel.scatter} storeName={sel.storeName} />
                </div>

                {/* Row 5: GPT report section */}
                {selWx && <ReportSection analytics={sel} weather={selWx} />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
