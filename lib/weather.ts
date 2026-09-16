/**
 * Open-Meteo weather client with file-based caching.
 *
 * Cache location:
 *   development  → .cache/weather/{storeId}-{type}.json
 *   production   → /tmp/weather-ops/{storeId}-{type}.json
 *
 * TTL: archive 24 h | forecast 1 h
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { STORES } from './stores'
import { getRollingArchiveRange } from './dateRange'

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_DIR =
  process.env.NODE_ENV === 'production'
    ? join(tmpdir(), 'weather-ops')
    : join(process.cwd(), '.cache', 'weather')

const TTL = {
  archive:  24 * 60 * 60 * 1000,  // 24 h — history doesn't change
  forecast:  1 * 60 * 60 * 1000,  //  1 h — forecasts update hourly
}

interface CacheEnvelope<T> {
  cachedAt: string
  data: T
}

function readCache<T>(key: string, ttlMs: number): T | null {
  const file = join(CACHE_DIR, `${key}.json`)
  if (!existsSync(file)) return null
  try {
    const envelope = JSON.parse(readFileSync(file, 'utf-8')) as CacheEnvelope<T>
    if (Date.now() - new Date(envelope.cachedAt).getTime() > ttlMs) return null
    return envelope.data
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T): void {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(
    join(CACHE_DIR, `${key}.json`),
    JSON.stringify({ cachedAt: new Date().toISOString(), data }),
    'utf-8',
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyPoint {
  date: string
  tempMax: number
  tempMin: number
  precip: number           // mm
  apparentTempMax: number
}

export interface StoreWeather {
  storeId: string
  archive: DailyPoint[]   // 2025-07-01 → yesterday
  forecast: DailyPoint[]  // today → +7 days
  cachedAt: string
}

// ── Open-Meteo response shape ────────────────────────────────────────────────

interface OpenMeteoDaily {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_sum: number[]
  apparent_temperature_max: number[]
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily
}

const DAILY_VARS =
  'temperature_2m_max,temperature_2m_min,precipitation_sum,apparent_temperature_max'

function parsePoints(daily: OpenMeteoDaily): DailyPoint[] {
  return daily.time.map((date, i) => ({
    date,
    tempMax:         daily.temperature_2m_max[i]        ?? 20,
    tempMin:         daily.temperature_2m_min[i]        ?? 10,
    precip:          daily.precipitation_sum[i]          ?? 0,
    apparentTempMax: daily.apparent_temperature_max[i]   ?? 20,
  }))
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchArchive(lat: number, lon: number): Promise<DailyPoint[]> {
  // Rolling window: always "the most recent N days up to ~2 days ago",
  // shared with the synthetic sample-data generator (lib/sampleData.ts)
  // so archive weather and sample sales dates always overlap.
  const { startDate, endDate } = getRollingArchiveRange()

  const params = new URLSearchParams({
    latitude:   String(lat),
    longitude:  String(lon),
    start_date: startDate,
    end_date:   endDate,
    daily:      DAILY_VARS,
    timezone:   'Asia/Seoul',
  })

  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as OpenMeteoResponse
  return parsePoints(json.daily)
}

async function fetchForecast(lat: number, lon: number): Promise<DailyPoint[]> {
  const params = new URLSearchParams({
    latitude:      String(lat),
    longitude:     String(lon),
    daily:         DAILY_VARS,
    forecast_days: '7',
    timezone:      'Asia/Seoul',
  })

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo forecast ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as OpenMeteoResponse
  return parsePoints(json.daily)
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getStoreWeather(storeId: string): Promise<StoreWeather> {
  const store = STORES.find((s) => s.id === storeId)
  if (!store) throw new Error(`Unknown storeId: ${storeId}`)

  const [archive, forecast] = await Promise.all([
    (readCache<DailyPoint[]>(`${storeId}-archive`, TTL.archive) ??
      fetchArchive(store.lat, store.lon).then((d) => {
        writeCache(`${storeId}-archive`, d)
        return d
      })),
    (readCache<DailyPoint[]>(`${storeId}-forecast`, TTL.forecast) ??
      fetchForecast(store.lat, store.lon).then((d) => {
        writeCache(`${storeId}-forecast`, d)
        return d
      })),
  ])

  return { storeId, archive, forecast, cachedAt: new Date().toISOString() }
}

export async function getAllStoresWeather(): Promise<StoreWeather[]> {
  return Promise.all(STORES.map((s) => getStoreWeather(s.id)))
}
