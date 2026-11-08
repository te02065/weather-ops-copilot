/**
 * GET /api/weather/forecast?date=2026-11-05
 * 이 파일이 하는 일: 목표일의 단기예보(기온, 1시간 강수량 합)를 매장 격자 칸 기준으로 돌려줍니다.
 * 입력: 목표일 (YYYY-MM-DD). 매장 격자는 data/stores.json의 첫 매장을 씁니다.
 * 출력: { source: "forecast", base, day, missingHours } 또는 오류 { code, message, hint }
 * 주의점: 서버에서만 실행됩니다. 키는 .env.local의 KMA_API_KEY를 읽고 응답에 넣지 않습니다.
 *         같은 발표와 같은 날짜는 data/weather_cache에 저장해 다시 부르지 않습니다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { fetchForecastDay } from '@/weather/forecastFetch'
import { baseDateIso, baseForTarget } from '@/weather/forecastBase'
import { CONFIG } from '@/analysis/config'
import { fetchMid, midDates } from '@/weather/midFcst'
import { daysBetween } from '@/analysis/dates'
import { readKmaKey } from '@/weather/kmaKey'
import { skyFromText } from '@/weather/forecastDay'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const CACHE_DIR = join(process.cwd(), 'data', 'weather_cache', 'forecast')

interface StoreGrid { nx: number; ny: number }

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') ?? ''
  if (!DATE.test(date)) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '날짜(YYYY-MM-DD)를 확인하세요.' }, { status: 400 })
  }
  const grid = readStoreGrid()
  if (!grid) {
    return NextResponse.json({ code: 'E_STORE_GRID', message: '매장 격자 번호를 찾지 못했습니다.', hint: 'data/stores.json의 forecastGrid를 확인하세요.' }, { status: 500 })
  }
  const key = readKmaKey(process.env)
  if (!key.ok) {
    return NextResponse.json({ code: key.error.code, message: key.error.message, hint: key.error.hint }, { status: 500 })
  }
  const base = baseForTarget(Date.now(), date)
  if (daysBetween(baseDateIso(base), date) > CONFIG.forecastMaxDaysAhead) {
    return midForecast(date, key.key)
  }
  const cachePath = join(CACHE_DIR, `${base.baseDate}${base.baseTime}-${date}-${grid.nx}-${grid.ny}-v3.json`)
  if (existsSync(cachePath)) {
    return NextResponse.json({ source: 'forecast', cached: true, ...JSON.parse(readFileSync(cachePath, 'utf-8')) })
  }
  const result = await fetchForecastDay(date, grid, base, key.key)
  if (!result.ok) {
    return NextResponse.json({ code: result.error.code, message: result.error.message, hint: result.error.hint }, { status: 502 })
  }
  const body = { base, day: result.day, missingHours: result.missingHours }
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cachePath, JSON.stringify(body), 'utf-8')
  return NextResponse.json({ source: 'forecast', cached: false, ...body })
}

/** 매장 격자 번호 (첫 매장). 없거나 숫자가 아니면 null. */
function readStoreGrid(): StoreGrid | null {
  try {
    const stores = JSON.parse(readFileSync(join(process.cwd(), 'data', 'stores.json'), 'utf-8')) as {
      stores: Array<{ forecastGrid?: { nx?: number; ny?: number } }>
    }
    const g = stores.stores[0]?.forecastGrid
    return g && Number.isInteger(g.nx) && Number.isInteger(g.ny) ? { nx: g.nx!, ny: g.ny! } : null
  } catch {
    return null
  }
}

/** 단기예보 기간 밖(+5일 이후)은 중기예보의 06시 발표를 씁니다. 발표 06시 전이면 어제 06시 발표입니다. */
async function midForecast(date: string, key: string): Promise<Response> {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const baseYmd = kst.getUTCHours() >= 6 ? ymdOf(kst) : ymdOf(new Date(kst.getTime() - 86400e3))
  if (!midDates(baseYmd).some((m) => m.date === date)) {
    return NextResponse.json({ code: 'E_FORECAST_RANGE', message: '이 날짜는 예보 기간 밖입니다.', hint: '중기예보는 발표일 기준 4~10일 뒤까지입니다.' }, { status: 400 })
  }
  const result = await fetchMid(baseYmd, key)
  if (!result.ok) return NextResponse.json({ code: result.error.code, message: result.error.message, hint: result.error.hint }, { status: 502 })
  const m = result.days[date]
  if (!m) return NextResponse.json({ code: 'E_FORECAST_RANGE', message: '이 날짜는 중기예보 값이 없습니다.' }, { status: 400 })
  const probs = [m.rnStAm, m.rnStPm].filter((x): x is number => x !== null)
  const tempAvg = m.taMin !== null && m.taMax !== null ? Math.round(((m.taMin + m.taMax) / 2) * 10) / 10 : null
  const prob = probs.length ? Math.max(...probs) : null
  const day = { date, precipMm: null, tempAvg, tempMax: m.taMax, tempMin: m.taMin, windMs: null, rainProbPct: prob, popPct: prob, sky: skyFromText(m.wfAm ?? m.wfPm) }
  return NextResponse.json({ source: 'mid', base: { baseDate: baseYmd, baseTime: '0600' }, day, missingHours: 0 })
}

function ymdOf(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}
