/**
 * 이 파일이 하는 일: 관측 날씨를 캐시에서 먼저 찾고, 없는 날짜만 기상청에서 받아 캐시에 합칩니다.
 * 입력: 관측소 번호, 기간, 캐시 폴더, 기간 조각을 받아 응답 텍스트를 돌려주는 함수(fetchChunk)
 * 출력: { days (stale 표시 포함), missing (끝까지 없는 날짜), stale } 또는 오류
 * 주의점: 캐시에 모든 날짜가 있으면 기상청을 부르지 않습니다 (테스트로 확인).
 *         요청이 실패하면 캐시 값을 쓰고 stale: true를 붙입니다. 캐시도 없으면 오류입니다.
 *         요청 사이에는 kmaMinIntervalMs만큼 기다립니다. 기다리는 함수(sleep)는 테스트에서 가짜로 바꿉니다.
 *         이 파일은 키를 직접 다루지 않습니다. 키는 fetchChunk를 만드는 쪽이 넣습니다.
 */

import { CONFIG } from '../analysis/config'
import { log } from '../analysis/logger'
import { makeStageError, type StageError } from '../analysis/errors'
import { addDaysIso } from '../analysis/dates'
import { parseAsosDaily, splitDateRange, type DateChunk } from './asos'
import { cacheFilePath, missingDates, rangeDates, readCache, writeCache } from './cache'
import type { WeatherObs } from './types'
import type { AsosFetchResult } from './kmaClient'

export interface ObservedRequest {
  stationId: string
  start: string
  end: string
  today?: string // 기준 날짜 (테스트용). 없으면 오늘
  cacheDir?: string
  fetchChunk: (chunk: DateChunk) => Promise<AsosFetchResult>
  sleep?: (ms: number) => Promise<void>
}

export type ObservedResult =
  | { ok: true; days: WeatherObs[]; missing: string[]; stale: boolean; error: StageError | null }
  | { ok: false; error: StageError }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function getObservedDaily(req: ObservedRequest): Promise<ObservedResult> {
  if (!/^\d+$/.test(req.stationId)) {
    return { ok: false, error: makeStageError('weather.fetch', 'E_KMA_RESPONSE',
      '관측소 번호가 확정되지 않았습니다 ([확인 필요]).',
      '지점정보 조회로 관측소 번호를 확인한 뒤 다시 실행하세요.') }
  }
  // 아직 확정되지 않은 최근 날짜는 요청하지 않습니다. 안 그러면 실행할 때마다 빠진 날로 남아 계속 요청합니다.
  const today = req.today ?? new Date().toISOString().slice(0, 10)
  const latest = addDaysIso(today, -CONFIG.kmaLatestLagDays)
  const end = req.end > latest ? latest : req.end
  const path = cacheFilePath(req.stationId, req.cacheDir)
  const cache = readCache(path, req.stationId)
  const toFetch = missingDates(cache.days, req.start, end)
  const fetchedNow = new Set<string>()
  let fetchError: StageError | null = null

  log('weather.fetch', 'start', { inCount: toFetch.length })
  if (toFetch.length > 0) {
    fetchError = await fetchMissing(req, toFetch, cache.days, fetchedNow)
    if (fetchedNow.size > 0) writeCache(path, cache)
  }

  const all = rangeDates(req.start, end)
  const days = all
    .filter((d) => cache.days[d] !== undefined)
    .map((d) => ({ ...cache.days[d]!, stale: fetchError !== null && !fetchedNow.has(d) }))
  const missing = all.filter((d) => cache.days[d] === undefined)

  if (days.length === 0 && fetchError !== null) {
    log('weather.fetch', 'error', { code: fetchError.code, message: fetchError.message, hint: fetchError.hint })
    return { ok: false, error: fetchError }
  }
  log('weather.fetch', 'end', { outCount: days.length })
  return { ok: true, days, missing, stale: fetchError !== null, error: fetchError }
}

/** 빠진 날짜를 기간 조각으로 받아 cache.days에 합칩니다. 실패하면 오류를 돌려주고 멈춥니다. */
async function fetchMissing(
  req: ObservedRequest,
  toFetch: string[],
  days: Record<string, WeatherObs>,
  fetchedNow: Set<string>,
): Promise<StageError | null> {
  const sleep = req.sleep ?? defaultSleep
  const chunks = splitDateRange(toFetch[0]!, toFetch[toFetch.length - 1]!)
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(CONFIG.kmaMinIntervalMs)
    const response = await req.fetchChunk(chunks[i]!)
    if (!response.ok) return response.error
    const parsed = parseAsosDaily(response.text, req.stationId)
    if (!parsed.ok) return parsed.error
    for (const obs of parsed.days) {
      days[obs.date] = { ...obs, stale: false }
      fetchedNow.add(obs.date)
    }
  }
  return null
}
