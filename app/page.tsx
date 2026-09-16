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
import LanguageToggle       from '@/components/LanguageToggle'
import { useLanguage }      from '@/lib/i18n/LanguageContext'

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
  const { t } = useLanguage()
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
    const res = await fetch('/api/sample-data')
    if (!res.ok) throw new Error('Failed to load sample data')
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
              <h1 className="text-h2 leading-tight">WeDOC</h1>
              <p className="text-xs text-slate-400">{t.appSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {analytics && (
              <button
                onClick={() => { setAnalytics(null); setWeather(null) }}
                className="text-action-l text-slate-400 hover:text-slate-700 transition"
              >
                {t.uploadNewFile}
              </button>
            )}
          </div>
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
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t.selectStore}</h2>
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
                      <div className="text-action-l">{a.storeName}</div>
                      <div className={`text-xs mt-0.5 ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                        {t.avg} ₩{a.summary.avgDailySales.toLocaleString()}
                        &nbsp;·&nbsp;{t.precipR}={a.correlations.salesVsPrecip}
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
