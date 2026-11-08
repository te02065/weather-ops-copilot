/**
 * 이 파일이 하는 일: 관측 날씨를 data/weather_cache/asos-<관측소번호>.json 파일에 저장하고 읽습니다.
 * 입력: 관측소 번호, 기간, 캐시 폴더 경로
 * 출력: 캐시 내용, 빠진 날짜 목록, 기간 날짜 목록
 * 주의점: 캐시는 날짜별로 저장합니다. 이미 있는 날짜는 다시 요청하지 않습니다 (설계 F3).
 *         data/ 폴더는 git에서 제외되어 있습니다. 파일에는 날씨 값만 있고 키는 없습니다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { daysBetween } from '../analysis/dates'
import type { WeatherObs } from './types'
import type { DailyWeather } from '../analysis/types'

export const DEFAULT_CACHE_DIR = join('data', 'weather_cache')

export interface CacheFile {
  stationId: string
  days: Record<string, WeatherObs> // 날짜(YYYY-MM-DD) → 관측값
}

export function cacheFilePath(stationId: string, dir: string = DEFAULT_CACHE_DIR): string {
  return join(dir, `asos-${stationId}.json`)
}

/** 캐시 파일을 읽습니다. 파일이 없으면 빈 캐시입니다. */
export function readCache(path: string, stationId: string): CacheFile {
  if (!existsSync(path)) return { stationId, days: {} }
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as CacheFile
  return { stationId, days: parsed.days ?? {} }
}

export function writeCache(path: string, cache: CacheFile): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
}

/** 시작일부터 끝일까지 모든 날짜 (YYYY-MM-DD 목록). */
export function rangeDates(start: string, end: string): string[] {
  const out: string[] = []
  const total = daysBetween(start, end) + 1
  for (let i = 0; i < total; i++) {
    const d = new Date(`${start}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** 기간 안에서 캐시에 없는 날짜. */
export function missingDates(days: Record<string, WeatherObs>, start: string, end: string): string[] {
  return rangeDates(start, end).filter((d) => days[d] === undefined)
}

/** 캐시의 관측값을 분석 입력(DailyWeather)으로 바꿉니다. 바람 자료는 캐시에 없으므로 null입니다. */
export function cacheToDaily(cache: CacheFile): DailyWeather[] {
  return Object.values(cache.days)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => ({ date: d.date, precipMm: d.precipMm, tempAvg: d.tempAvg, tempMax: d.tempMax, tempMin: d.tempMin, windMs: null }))
}
