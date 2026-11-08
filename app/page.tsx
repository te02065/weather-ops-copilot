'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { decodeCsvBytes } from '@/analysis/encoding'
import { readCsvText } from '@/analysis/csv'
import { ingestSalesCsv, ingestSalesCsvBytes } from '@/analysis/ingest'
import { runPipeline, type PipelineResult } from '@/analysis/pipeline'
import { parseWeatherCsv } from '@/analysis/weatherInput'
import { dowSummary, dailySeries, bandCounts } from '@/analysis/summary'
import type { CalendarEvent, ColumnMapping, DailyWeather } from '@/analysis/types'
import { buildFacts } from '@/briefing/facts'
import { weekCounts, sameWeatherName, menuSummary } from '@/analysis/weeklyBriefing'
import { weatherView } from '@/analysis/forecastView'
import type { HolidayItem } from '@/holidays/kasi'
import IngestReviewCard, { type IngestReview } from '@/components/IngestReviewCard'
import MenuReviewCard from '@/components/MenuReviewCard'
import PosSummaryCard from '@/components/PosSummaryCard'
import CategoryWeatherCard from '@/components/CategoryWeatherCard'
import { readXlsx } from '@/analysis/xlsx'
import { parsePosReport, SALES_SHEET, type PosReport } from '@/analysis/posReport'
import { categoryByBand, topNames } from '@/analysis/menuWeather'
import { threeCriteria, nextDates } from '@/analysis/threeCriteria'
import { festivalSets } from '@/analysis/festival'
import NextSevenDaysCard from '@/components/NextSevenDaysCard'
import MenuCriteriaCard from '@/components/MenuCriteriaCard'
import WeeklyBriefingCard from '@/components/WeeklyBriefingCard'
import { menuCriteria } from '@/analysis/menuCriteria'
import { forecastBands } from '@/analysis/threeCriteria'
import type { DayInput } from '@/analysis/weeklyBriefing'
import { detectMenuFormat, type Category } from '@/analysis/menuCategory'
import { suggestCategories, type SuggestedMenu } from '@/analysis/menuCatalog'
import { outlookDay, type DayOutlook } from '@/analysis/outlook'
import { CONFIG } from '@/analysis/config'
import { addDaysIso, localTodayIso } from '@/analysis/dates'
import UploadSection from '@/components/UploadSection'
import MappingForm from '@/components/MappingForm'
import VerdictCard from '@/components/VerdictCard'
import PredictionCard from '@/components/PredictionCard'
import EffectBadges from '@/components/EffectBadges'
import DowBarChart from '@/components/DowBarChart'
import SalesTimeline from '@/components/SalesTimeline'
import BriefingCard from '@/components/BriefingCard'
import LanguageToggle from '@/components/LanguageToggle'
import SimilarDaysCard from '@/components/SimilarDaysCard'
import WeatherExplainCard from '@/components/WeatherExplainCard'
import { WeatherSalesCard, DowWeatherCard, TempChangeCard, BasicStatsCard, MonthCalendarCard } from '@/components/HistoryPanels'
import TrustLights from '@/components/TrustLights'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// 지도는 브라우저에서만 그립니다
const StoreMap = dynamic(() => import('@/components/StoreMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Loading map…
    </div>
  ),
})

type Ok = Extract<PipelineResult, { ok: true }>

interface StoreInfo {
  storeCode: string
  storeName: string
  location: { lat: number; lon: number; source: string }
  station: { id: string | null; name?: string; distanceKm?: number; warning?: boolean; note?: string }
}

// 합성 샘플 파일의 열 이름 (샘플은 우리가 만든 파일이므로 고정 매핑을 씁니다)
const SAMPLE_MAPPING: ColumnMapping = { date: 'date', sales: 'sales', transactions: 'transactions', iceSales: 'ice_sales', hotSales: 'hot_sales' }

export default function Home() {
  useLanguage()
  const [phase, setPhase] = useState<'upload' | 'mapping' | 'result'>('upload')
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ bytes: Uint8Array; headers: string[] } | null>(null)
  const [result, setResult] = useState<Ok | null>(null)
  const [source, setSource] = useState<'real' | 'synthetic'>('real')
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<HolidayItem[]>([])
  const [review, setReview] = useState<IngestReview | null>(null)
  const [forecasts, setForecasts] = useState<Record<string, DailyWeather | null>>({})
  const [periodStart, setPeriodStart] = useState<string>('')
  const [outlookDates, setOutlookDates] = useState<string[]>([])
  const lastRun = useRef<{ rows: Parameters<typeof runPipeline>[0]['sales']; weather: DailyWeather[]; events: CalendarEvent[] } | null>(null)
  const [forecastLeft, setForecastLeft] = useState(0)
  const [posReport, setPosReport] = useState<PosReport | null>(null)
  const [menuReview, setMenuReview] = useState<{ storeId: string; suggestions: SuggestedMenu[]; chosen: Record<string, Category> } | null>(null)

  const [storeList, setStoreList] = useState<Array<{ storeCode: string; storeName: string }>>([])

  /** 매장 정보를 읽습니다. 기본 매장은 새소리입니다 (없으면 목록의 첫 매장). */
  async function loadStore(storeId: string) {
    try {
      const r = await fetch(`/api/store?storeId=${encodeURIComponent(storeId)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.message ?? '매장 정보를 읽지 못했습니다.')
      setStore(data as StoreInfo)
      setStoreError(null)
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : '매장 정보를 읽지 못했습니다.')
    }
  }

  useEffect(() => {
    fetch('/api/stores')
      .then(async (r) => (await r.json()) as { stores: Array<{ storeCode: string; storeName: string }> })
      .then((data) => {
        setStoreList(data.stores)
        const pick = data.stores.find((s) => s.storeCode === 'SAESORI') ?? data.stores[0]
        if (pick) void loadStore(pick.storeCode)
        else setStoreError('등록된 매장이 없습니다.')
      })
      .catch(() => setStoreError('매장 목록을 읽지 못했습니다.'))
  }, [])

  async function onFile(file: File) {
    setError(null)
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (file.name.toLowerCase().endsWith('.xlsx')) return onPosFile(bytes)
    const decoded = decodeCsvBytes(bytes)
    if (!decoded.ok) return setError('파일을 UTF-8이나 CP949로 읽지 못했습니다. 엑셀에서 CSV로 다시 저장해 주세요.')
    const headers = readCsvText(decoded.text).fields
    if (headers.length === 0) return setError('파일에 헤더(첫 줄)가 없습니다.')
    setPending({ bytes, headers })
    setMenuReview(await loadMenuReview(decoded.text, headers))
    setPhase('mapping')
  }

  /**
   * POS 엑셀 리포트: 열 구조가 정해져 있으므로 열 고르기 없이 바로 분석합니다.
   * 일별 결제금액(순매출)을 기존 분석 입력으로 넘기고, 메뉴 집계는 POS 카드에 씁니다.
   */
  async function onPosFile(bytes: Uint8Array) {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const report = parsePosReport(await readXlsx(bytes))
      if (!report.period || report.daily.length === 0) {
        return setError(`엑셀에서 매출 날짜를 찾지 못했습니다. ${report.warnings.join(' ')}`.trim())
      }
      const csv = ['date,sales,transactions', ...report.daily.map((d) => `${d.date},${Math.round(d.netSales)},${Math.round(d.payCount)}`)].join('\n')
      const mapping: ColumnMapping = { date: 'date', sales: 'sales', transactions: 'transactions' }
      // 경고는 "결제 합계 시트 2026-03-14 행"처럼 시트 이름과 날짜로 가리킵니다 (임시 CSV 줄 번호는 엑셀 줄이 아닙니다)
      const ingest = ingestSalesCsv(csv, mapping, (r) => `'${SALES_SHEET}' 시트 ${r.date} 행`)
      if (!ingest.ok) return setError(ingest.errors.map((e) => `${e.message}\n→ ${e.hint}`).join('\n\n'))
      const weather = await fetchWeather(ingest.summary.dateStart!, ingest.summary.dateEnd!)
      const holidayList = await fetchHolidays(ingest.summary.dateStart!, ingest.summary.dateEnd!)
      const forecast = await fetchForecast(addDaysIso(localTodayIso(), 1))
      setPosReport(report)
      finish(ingest.rows, weather, 'real', holidayList, { mapping, summary: ingest.summary, warnings: ingest.warnings }, forecast)
    } catch (err) {
      setError(err instanceof Error ? err.message : '엑셀을 분석하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** 파일에서 메뉴 이름을 찾아 매장 메뉴표와 맞춥니다. 메뉴 열이 없으면 null. */
  async function loadMenuReview(text: string, headers: string[]) {
    if (!store) return null
    const format = detectMenuFormat(headers)
    const names =
      format.kind === 'long'
        ? Array.from(new Set(readCsvText(text).records.map((r) => (r.values[format.menuCol] ?? '').trim()).filter((n) => n !== '')))
        : format.kind === 'wide' ? format.menuCols : []
    if (names.length === 0) return null
    try {
      const res = await fetch(`/api/menu-catalog?storeId=${encodeURIComponent(store.storeCode)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      return { storeId: store.storeCode, suggestions: suggestCategories(names, data.catalog), chosen: {} }
    } catch {
      return { storeId: store.storeCode, suggestions: suggestCategories(names, { storeId: store.storeCode, items: {} }), chosen: {} }
    }
  }

  async function onMapping(mapping: ColumnMapping) {
    if (!pending) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      if (menuReview && Object.keys(menuReview.chosen).length > 0) {
        const saved = await fetch('/api/menu-catalog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: menuReview.storeId, changes: menuReview.chosen }),
        })
        if (!saved.ok) {
          const data = await saved.json()
          return setError(data.message ?? '메뉴 분류를 저장하지 못했습니다.')
        }
      }
      const ingest = ingestSalesCsvBytes(pending.bytes, mapping)
      if (!ingest.ok) {
        setError(ingest.errors.map((e) => `${e.message}\n→ ${e.hint}`).join('\n\n'))
        return
      }
      const weather = await fetchWeather(ingest.summary.dateStart!, ingest.summary.dateEnd!)
      const holidayList = await fetchHolidays(ingest.summary.dateStart!, ingest.summary.dateEnd!)
      const forecast = await fetchForecast(addDaysIso(localTodayIso(), 1))
      finish(ingest.rows, weather, 'real', holidayList, { mapping, summary: ingest.summary, warnings: ingest.warnings }, forecast)
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 났습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function onSample() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sample-data')
      const data = (await res.json()) as { sales: string; weather: string }
      const ingest = ingestSalesCsv(data.sales, SAMPLE_MAPPING)
      if (!ingest.ok) return setError(ingest.errors[0]?.message ?? '샘플을 읽지 못했습니다.')
      const weather = parseWeatherCsv(data.weather).rows
      const forecast = await fetchForecast(addDaysIso(localTodayIso(), 1))
      finish(ingest.rows, weather, 'synthetic', [], { mapping: SAMPLE_MAPPING, summary: ingest.summary, warnings: ingest.warnings }, forecast)
    } catch (err) {
      setError(err instanceof Error ? err.message : '샘플을 읽지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** 기상청 관측 날씨를 기간만큼 받습니다 (서버 캐시 우선). 날짜 범위와 관측소 번호만 보냅니다. */
  async function fetchWeather(start: string, end: string): Promise<DailyWeather[]> {
    if (!store?.station.id) throw new Error('날씨 측정소가 정해지지 않았어요. 매장 설정을 확인하세요.')
    const res = await fetch(`/api/weather/observed?stationId=${store.station.id}&start=${start}&end=${end}`)
    const data = await res.json()
    if (!res.ok) throw new Error(`${data.message ?? '날씨를 받지 못했습니다.'}${data.hint ? `\n→ ${data.hint}` : ''}`)
    const days = data.days as Array<{ date: string; precipMm: number | null; tempAvg: number | null; tempMax: number | null; tempMin: number | null }>
    if (data.stale) setNotice(`기상청 요청이 실패해 이전 캐시 값을 썼습니다. ${data.warning ?? ''}`)
    return days.map((d) => ({ date: d.date, precipMm: d.precipMm, tempAvg: d.tempAvg, tempMax: d.tempMax, tempMin: d.tempMin, windMs: null }))
  }

  /** 기간 안의 공휴일을 받습니다. 실패해도 분석은 계속하고, 공휴일을 반영하지 못했다고 알립니다. */
  async function fetchHolidays(start: string, end: string): Promise<HolidayItem[]> {
    try {
      const res = await fetch(`/api/holidays?start=${start}&end=${end}`)
      const data = await res.json()
      if (!res.ok) throw new Error(`${data.message ?? '공휴일을 받지 못했습니다.'}${data.hint ? ` ${data.hint}` : ''}`)
      return data.holidays as HolidayItem[]
    } catch (err) {
      const msg = err instanceof Error ? err.message : '공휴일을 받지 못했습니다.'
      setNotice((prev) => [prev, `공휴일을 반영하지 못했습니다: ${msg}`].filter(Boolean).join(' '))
      return []
    }
  }

  /** 7일 추이용 예보를 하루씩 받습니다. 한 번에 하나씩 받아서 화면이 날마다 채워지게 합니다. */
  /**
   * 시작일부터 7일의 날씨를 받습니다. 지난 날은 실제 관측 날씨, 오늘 이후는 예보를 씁니다.
   * 사용자가 고른 기간에 맞춰 다시 부를 수 있습니다.
   */
  async function loadOutlook(start: string) {
    const dates = nextDates(addDaysIso(start, -1), CONFIG.outlookDays)
    const today = localTodayIso()
    setOutlookDates(dates)
    setForecasts({})
    setForecastLeft(dates.length)
    const past = dates.filter((d) => d < today)
    let observed: Record<string, DailyWeather> = {}
    if (past.length > 0) {
      try {
        const days = await fetchWeather(past[0]!, past[past.length - 1]!)
        observed = Object.fromEntries(days.map((d) => [d.date, d]))
      } catch {
        observed = {}
      }
    }
    for (const date of dates) {
      const day = date < today ? (observed[date] ?? null) : await fetchForecastQuiet(date)
      setForecasts((prev) => ({ ...prev, [date]: day }))
      setForecastLeft((n) => n - 1)
    }
  }

  /** 지난 하루의 실제 관측 날씨. 없으면 null. */
  async function observedDay(date: string): Promise<DailyWeather | null> {
    try {
      const days = await fetchWeather(date, date)
      return days.find((d) => d.date === date) ?? null
    } catch {
      return null
    }
  }

  /** 사용자가 고른 시작일로 다시 계산합니다. 그 날짜 이전 기록만으로 학습합니다. */
  async function applyPeriod(start: string) {
    const run = lastRun.current
    if (!run || !store || !start) return
    // 시작일 하루의 날씨: 지난 날은 실제 관측, 오늘 이후는 예보
    const dayWeather = start < localTodayIso() ? await observedDay(start) : await fetchForecastQuiet(start)
    const r = runPipeline({
      storeCode: store.storeCode, sales: run.rows, weather: run.weather, events: run.events,
      targetDate: start, cutoffOverride: addDaysIso(start, -1), targetForecast: dayWeather,
    })
    if (!r.ok) return setError(`${start} 이전 기록이 부족해 예측할 수 없어요.`)
    setResult(r)
    setPeriodStart(start)
    void loadOutlook(start)
  }

  async function fetchForecastQuiet(date: string): Promise<DailyWeather | null> {
    try {
      const res = await fetch(`/api/weather/forecast?date=${date}`)
      const data = await res.json()
      return res.ok ? (data.day as DailyWeather) : null
    } catch {
      return null
    }
  }

  /** 목표일 단기예보를 받습니다. 실패하면 기준선만으로 계산하고, 그 이유를 알립니다. */
  async function fetchForecast(date: string): Promise<DailyWeather | null> {
    try {
      const res = await fetch(`/api/weather/forecast?date=${date}`)
      const data = await res.json()
      if (!res.ok) throw new Error(`${data.message ?? '예보를 받지 못했습니다.'}${data.hint ? ` ${data.hint}` : ''}`)
      return data.day as DailyWeather
    } catch (err) {
      const msg = err instanceof Error ? err.message : '예보를 받지 못했습니다.'
      setNotice((prev) => [prev, `예보를 받지 못해 보통 날 기준으로만 계산했습니다: ${msg}`].filter(Boolean).join(' '))
      return null
    }
  }

  function finish(rows: Parameters<typeof runPipeline>[0]['sales'], weather: DailyWeather[], kind: 'real' | 'synthetic', holidayList: HolidayItem[], reviewInfo: IngestReview, forecast: DailyWeather | null) {
    if (!store) throw new Error('매장 정보를 아직 읽지 못했습니다.')
    const events: CalendarEvent[] = holidayList.map((h) => ({ date: h.date, type: 'holiday' }))
    const r = runPipeline({ storeCode: store.storeCode, sales: rows, weather, events, targetForecast: forecast })
    if (!r.ok) {
      setError(`영업한 날이 ${r.validDays}일뿐이라 예측을 만들지 않았어요 (최소 ${r.minDays}일 필요).`)
      return
    }
    setSource(kind)
    setHolidays(holidayList)
    setReview(reviewInfo)
    lastRun.current = { rows, weather, events }
    setResult(r)
    // 기본 시작일은 사용자가 사용하는 날의 다음 날입니다
    applyPeriod(addDaysIso(localTodayIso(), 1))
    setPhase('result')
    setPending(null)
  }

  function reset() {
    setResult(null)
    setHolidays([])
    setReview(null)
    setForecasts({})
    setForecastLeft(0)
    setMenuReview(null)
    setPosReport(null)
    setPending(null)
    setPhase('upload')
    setError(null)
    setNotice(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌤️</span>
            <div>
              <h1 className="text-h2 leading-tight">WeDOC</h1>
              <p className="text-xs text-slate-400">날씨와 매출의 관계를 계산합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            {phase !== 'upload' && (
              <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-700 transition">다른 파일</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-2">
          매출 파일은 이 브라우저에서만 읽습니다. 서버로 보내거나 저장하지 않습니다. 서버에는 날짜 범위와 관측소 번호만 전달합니다.
        </p>
        {phase === 'upload' && (
          <>
            {storeList.length > 0 && (
              <div className="max-w-xl mx-auto flex items-center gap-3 text-sm">
                <span className="text-slate-500">매장</span>
                <select
                  className="border border-slate-300 rounded-lg px-3 py-1 bg-white"
                  value={store?.storeCode ?? ''}
                  onChange={(e) => void loadStore(e.target.value)}
                >
                  {storeList.map((s) => <option key={s.storeCode} value={s.storeCode}>{s.storeName}</option>)}
                </select>
              </div>
            )}
            <UploadSection onFile={onFile} onSample={onSample} loading={loading} error={error ?? storeError} />
          </>
        )}
        {phase === 'mapping' && pending && (
          <>
            {menuReview && (
              <MenuReviewCard
                suggestions={menuReview.suggestions}
                chosen={menuReview.chosen}
                onChange={(name, category) => setMenuReview((m) => (m ? { ...m, chosen: { ...m.chosen, [name]: category } } : m))}
              />
            )}
            <MappingForm headers={pending.headers} onConfirm={onMapping} onCancel={reset} />
            {loading && <p className="text-center text-sm text-slate-500">분석 중…</p>}
            {error && <p className="max-w-xl mx-auto text-sm text-red-600 whitespace-pre-line bg-red-50 rounded-lg p-3">⚠️ {error}</p>}
          </>
        )}
        {phase === 'result' && result && store && (
          <Results result={result} store={store} source={source} notice={notice} holidays={holidays} review={review} forecasts={forecasts} forecastLeft={forecastLeft} pos={posReport} dates={outlookDates} periodStart={periodStart} onPeriodChange={applyPeriod} />
        )}
      </main>
    </div>
  )
}

function Results({ result, store, source, notice, holidays, review, forecasts, forecastLeft, pos, dates, periodStart, onPeriodChange }: {
  result: Ok; store: StoreInfo; source: 'real' | 'synthetic'; notice: string | null; holidays: HolidayItem[]; review: IngestReview | null
  forecasts: Record<string, DailyWeather | null>; forecastLeft: number; pos: PosReport | null
  dates: string[]; periodStart: string; onPeriodChange: (start: string) => void
}) {
  const isPastTarget = result.targetDate < localTodayIso()
  const events = holidays.map((h) => ({ date: h.date, type: 'holiday' as const }))
  // 날짜별 추이 (방향과 범위). 다음 7일 카드 안에 함께 보여 줍니다.
  const outlook: Array<DayOutlook | null> = dates.map((date) => (date in forecasts ? outlookDay(result.features, result.model, result.cutoff, date, forecasts[date] ?? null, events) : null))
  const catTable = pos ? categoryByBand(pos.menuDaily, result.features, (m) => m.posCategory) : null
  const topMenus = pos ? topNames(pos.menuDaily, 15, (m) => m.menu) : []
  const menuTable = pos ? categoryByBand(pos.menuDaily.filter((m) => topMenus.includes(m.menu)), result.features, (m) => m.menu) : null
  const counts = bandCounts(result.features, result.cutoff)
  // AI 브리핑 입력: 목표일(시작일) 하루의 예보, 세 기준, 추이, 메뉴 이름, 이번 7일 추이 개수 (금액은 기준값만)
  const factDate = dates[0] ?? result.targetDate
  const factForecast = forecasts[factDate] ?? null
  const factCriteria = threeCriteria(result.features, result.cutoff, factDate, factForecast, festivalSets(holidays))
  const factOutlook = outlook[0] ?? null
  const factMenu = pos && factDate in forecasts ? menuCriteria(pos.menuDaily, result.features, result.cutoff, factDate, forecastBands(factForecast)) : []
  const factView = weatherView(factForecast)
  const whole = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x))
  const facts = buildFacts({
    storeCode: result.storeCode,
    prediction: result.prediction,
    recommendations: result.recommendations,
    rainBand: factCriteria.weatherLabel,
    tempAvg: whole(factForecast?.tempAvg),
    weather: factForecast ? { sky: factView.sky || null, tempMin: whole(factForecast.tempMin), tempMax: whole(factForecast.tempMax), precipMm: factForecast.precipMm ?? null, popPct: factForecast.popPct ?? factForecast.rainProbPct ?? null } : null,
    criteria: { sameWeekdayAvg: factCriteria.sameWeekday.avg, sameWeekdayN: factCriteria.sameWeekday.n, lastYearSales: factCriteria.lastYear.sales, sameWeatherName: sameWeatherName(factCriteria), sameWeatherAvg: factCriteria.sameWeather.avg, sameWeatherN: factCriteria.sameWeather.n, sameWeatherRange: factCriteria.sameWeather.range ?? null },
    outlookDirection: factOutlook?.direction ?? null,
    outlookReason: factOutlook?.reason ?? null,
    menuMovers: menuSummary([{ criteria: factCriteria, outlook: null, menu: factMenu }]).movers,
    week: weekCounts(outlook),
  })
  return (
    <>
      {source === 'synthetic' && (
        <div className="bg-orange-100 border border-orange-300 text-orange-800 rounded-xl px-4 py-2 text-sm font-semibold">
          합성 데이터 (가짜 샘플) 입니다. 실제 매장 결과가 아닙니다.
        </div>
      )}
      {notice && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-sm">{notice}</div>}
      <BriefingCard facts={facts} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">예측 시작일</span>
        <input type="date" className="border border-slate-300 rounded-lg px-2 py-1 bg-white" value={periodStart} onChange={(e) => e.target.value && onPeriodChange(e.target.value)} />
        <span className="text-slate-500">고른 날부터 7일을 계산해요. 지난 날짜는 실제 날씨로 다시 맞춰 봅니다.</span>
      </div>
      <NextSevenDaysCard
        days={dates.map((date) => (date in forecasts ? threeCriteria(result.features, result.cutoff, date, forecasts[date] ?? null, festivalSets(holidays)) : null))}
        loadingCount={forecastLeft}
        outlook={outlook}
      />
      {pos && pos.menuDaily.length > 0 && (
        <MenuCriteriaCard menu={pos.menuDaily} features={result.features} cutoff={result.cutoff} dates={dates} forecasts={forecasts} />
      )}
      {dates.some((d) => d in forecasts) && (
        <WeeklyBriefingCard
          storeName={store.storeName}
          period={`${dates[0]} ~ ${dates[dates.length - 1]}`}
          validDays={result.validDays}
          days={dates.flatMap((date, i): DayInput[] => (date in forecasts ? [{
            criteria: threeCriteria(result.features, result.cutoff, date, forecasts[date] ?? null, festivalSets(holidays)),
            outlook: outlook[i] ?? null,
            menu: pos ? menuCriteria(pos.menuDaily, result.features, result.cutoff, date, forecastBands(forecasts[date])) : [],
          }] : []))}
        />
      )}
      {review && <IngestReviewCard review={review} />}
      {pos && <PosSummaryCard report={pos} />}
      {result.cutoff < addDaysIso(localTodayIso(), -2) && (
        <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2 text-sm">
          매출 기록은 {result.cutoff}까지 있어요. {addDaysIso(result.cutoff, 1)}부터 {addDaysIso(localTodayIso(), -1)}까지는 기록이 없어서 빈칸으로 두었어요.
        </div>
      )}
      {isPastTarget && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-sm">
          예측 날짜({result.targetDate})가 오늘보다 과거입니다. 이 결과는 지난 기록을 확인하는 용도로만 보세요.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StoreMap
            points={[{ id: store.storeCode, name: store.storeName, lat: store.location.lat, lon: store.location.lon }]}
            selectedId={store.storeCode}
            onSelect={() => {}}
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <div className="text-xs text-slate-400">매장</div>
          <div className="text-action-l">{store.storeName}</div>
          <div className="text-xs text-slate-500">코드 {result.storeCode}</div>
          <div className="text-sm text-slate-700">
            {result.cutoff}까지의 기록으로 {result.targetDate}의 매출을 예측합니다.
          </div>
          <div className="text-xs text-slate-500">
            영업한 날 {result.validDays}일 · 날씨 기록이 빠진 날 {(result.weatherMissingRatio * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500">
            가까운 날씨 측정소: {store.station.id ? `${store.station.name} (${store.station.id}), ${store.station.distanceKm?.toFixed(1)}km` : store.station.note ?? '확인 필요'}
          </div>
          <div className="text-xs">
            <span className={`px-2 py-0.5 rounded ${source === 'synthetic' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
              {source === 'synthetic' ? '합성 데이터' : '실제 기록'}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            공휴일 {holidays.length}일 반영 (한국천문연구원 특일 정보)
            {holidays.length > 0 && (
              <span className="block text-slate-400 mt-1">{holidays.map((h) => `${h.date.slice(5)} ${h.name}`).join(' · ')}</span>
            )}
          </div>
        </div>
      </div>

      <TrustLights
        trainDays={result.trainDays}
        weatherMissingRatio={result.weatherMissingRatio}
        verdict={result.report.comparison.verdict}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VerdictCard report={result.report} />
        <PredictionCard prediction={result.prediction} recommendations={result.recommendations} />
      </div>

      <EffectBadges model={result.model} counts={counts} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimilarDaysCard rows={result.features} cutoff={result.cutoff} />
        <WeatherExplainCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherSalesCard rows={result.features} />
        <DowWeatherCard rows={result.features} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TempChangeCard rows={result.features} />
        <BasicStatsCard rows={result.features} />
      </div>

      <MonthCalendarCard rows={result.features} cutoff={result.cutoff} />

      {catTable && (
        <CategoryWeatherCard
          title="날씨별 카테고리 매출"
          desc="POS 카테고리별 하루 평균 매출입니다. 같은 날씨였던 날들의 평균 차이이며 원인을 단정하지 않습니다."
          table={catTable}
        />
      )}
      {menuTable && (
        <CategoryWeatherCard
          title="날씨별 메뉴 매출 (상위 15개)"
          desc="금액 합계가 큰 메뉴부터 보여 줍니다. 비교할 날이 8일보다 적으면 평균을 숨깁니다."
          table={menuTable}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DowBarChart dowEffect={dowSummary(result.features)} />
        <SalesTimeline series={dailySeries(result.features)} storeName={store.storeName} />
      </div>

    </>
  )
}
