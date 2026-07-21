/**
 * Generates realistic synthetic sales data correlated with actual historical
 * weather from Open-Meteo archive API.
 *
 * Usage: npm run generate-data
 * Output: public/sample-data.csv
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// ── Store definitions ────────────────────────────────────────────────────────

const STORES = [
  { id: 'gangnam',  name: '강남점',        lat: 37.4979, lon: 127.0276, baseline: 850_000 },
  { id: 'hongdae',  name: '홍대점',        lat: 37.5563, lon: 126.9236, baseline: 720_000 },
  { id: 'pangyo',   name: '판교점',        lat: 37.3943, lon: 127.1110, baseline: 680_000 },
  { id: 'haeundae', name: '부산 해운대점', lat: 35.1587, lon: 129.1603, baseline: 590_000 },
  { id: 'jeju',     name: '제주점',        lat: 33.4996, lon: 126.5312, baseline: 510_000 },
] as const

const START_DATE = '2025-07-01'
const END_DATE   = '2026-07-10'

// ── Seeded PRNG (Mulberry32) — deterministic runs ───────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

// ── Weather ──────────────────────────────────────────────────────────────────

interface WeatherDay {
  date: string
  tempMax: number  // °C
  precip: number   // mm
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude:   String(lat),
    longitude:  String(lon),
    start_date: START_DATE,
    end_date:   END_DATE,
    daily:      'temperature_2m_max,precipitation_sum',
    timezone:   'Asia/Seoul',
  })
  const url = `https://archive-api.open-meteo.com/v1/archive?${params}`
  console.log(`  ↳ GET ${url.slice(0, 80)}...`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const data = (await res.json()) as {
    daily: {
      time: string[]
      temperature_2m_max: number[]
      precipitation_sum:  number[]
    }
  }

  return data.daily.time.map((date, i) => ({
    date,
    tempMax: data.daily.temperature_2m_max[i] ?? 20,
    precip:  data.daily.precipitation_sum[i]  ?? 0,
  }))
}

/** Fallback: synthetic seasonal weather when API is unavailable */
function syntheticWeather(lat: number): WeatherDay[] {
  const days: WeatherDay[] = []
  const start = new Date(START_DATE)
  const end   = new Date(END_DATE)

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const doy = Math.floor((+d - +new Date(d.getFullYear(), 0, 0)) / 86_400_000)

    // Korea seasonal curve: peak ~July (doy≈200), trough ~January (doy≈15)
    const baseTemp   = 13 - (lat - 33) * 1.5          // Jeju warmer than Seoul
    const seasonal   = baseTemp + 17 * Math.sin((doy - 90) * Math.PI / 183)
    const rng        = mulberry32(parseInt(dateStr.replace(/-/g, '')) + Math.round(lat * 100))
    const tempMax    = parseFloat((seasonal + (rng() - 0.5) * 6).toFixed(1))
    const rainProb   = 0.12 + 0.22 * Math.max(0, Math.sin((doy - 120) * Math.PI / 120))
    const precip     = rng() < rainProb ? parseFloat((rng() * 30).toFixed(1)) : 0

    days.push({ date: dateStr, tempMax, precip })
  }
  return days
}

// ── Sales generation ─────────────────────────────────────────────────────────

/**
 * Ice-to-total ratio rises with temperature.
 * Requirement: temp ≥ 30°C → ice sales +40% vs mild-weather baseline
 */
function calcIceRatio(tempMax: number): number {
  const base      = 0.30                                            // ~30% ice at 15°C
  const tempSlope = Math.max(0, (tempMax - 15) * 0.008)            // +0.8 pp / °C
  const heatBump  = tempMax >= 30 ? base * 0.40 : 0                // +40% of base at 30°C+
  return Math.min(0.80, base + tempSlope + heatBump)
}

function generateSales(
  baseline: number,
  day: WeatherDay,
  storeIdx: number,
): { totalSales: number; iceSales: number; hotSales: number; transactions: number } {
  const rng = mulberry32(
    parseInt(day.date.replace(/-/g, '')) * 31 + storeIdx * 9_999,
  )
  const dow = new Date(day.date).getDay()   // 0=Sun, 6=Sat

  let total = baseline

  // Weekend: +15%
  if (dow === 0 || dow === 6) total *= 1.15

  // Precipitation: -20% if heavy (≥5 mm), -8% if light (≥2 mm)
  if      (day.precip >= 5) total *= 0.80
  else if (day.precip >= 2) total *= 0.92

  // Daily noise: ±15%
  total *= 0.85 + rng() * 0.30
  total  = Math.round(total)

  const iceRatio    = calcIceRatio(day.tempMax)
  const iceSales    = Math.round(total * iceRatio)
  const hotSales    = total - iceSales
  const transactions = Math.max(10, Math.round(total / 4_800 + rng() * 8))

  return { totalSales: total, iceSales, hotSales, transactions }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   Weather-Driven Ops Copilot — Data Gen     ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log(`Period : ${START_DATE} → ${END_DATE}`)
  console.log(`Stores : ${STORES.length}`)
  console.log()

  const header = 'date,store_id,store_name,lat,lon,total_sales,ice_sales,hot_sales,transactions'
  const rows: string[] = [header]

  for (let i = 0; i < STORES.length; i++) {
    const store = STORES[i]
    console.log(`[${i + 1}/${STORES.length}] ${store.name}`)

    let weather: WeatherDay[]
    try {
      weather = await fetchWeather(store.lat, store.lon)
    } catch (err) {
      console.warn(`  ⚠️  API error (${err}), falling back to synthetic weather`)
      weather = syntheticWeather(store.lat)
    }

    for (const day of weather) {
      const s = generateSales(store.baseline, day, i)
      rows.push(
        [
          day.date,
          store.id,
          store.name,
          store.lat,
          store.lon,
          s.totalSales,
          s.iceSales,
          s.hotSales,
          s.transactions,
        ].join(','),
      )
    }
    console.log(`  ✓ ${weather.length} days`)
  }

  const publicDir = resolve(process.cwd(), 'public')
  mkdirSync(publicDir, { recursive: true })
  const outPath = resolve(publicDir, 'sample-data.csv')
  writeFileSync(outPath, rows.join('\n'), 'utf-8')

  const dataRows = rows.length - 1
  console.log()
  console.log(`✅ ${dataRows} rows → public/sample-data.csv`)
  console.log(`   (${STORES.length} stores × ~${Math.floor(dataRows / STORES.length)} days each)`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err)
  process.exit(1)
})
