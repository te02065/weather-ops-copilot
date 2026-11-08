/**
 * 이 파일이 하는 일: 기상청 ASOS 일자료(기간 조회, kma_sfcdd3.php) 요청 변수를 만들고, 응답을 하루 단위 관측값으로 바꿉니다.
 * 입력: 기간(YYYY-MM-DD), 관측소 번호, 응답 텍스트
 * 출력: 기간을 31일 단위로 나눈 목록, 요청 변수, WeatherObs 배열
 * 주의점: 키(authKey)는 이 파일에 없습니다. 키를 붙이는 일은 kmaClient.ts가 합니다.
 *         응답 열 순서는 명세서처럼 응답 안의 번호 목록("# 1. TM : ...")에서 읽습니다. 열 이름을 가정하지 않습니다.
 *         응답은 한 줄에 다 있지 않고 여러 줄로 나뉠 수 있으므로, 열 개수만큼 토큰을 모아 한 행으로 봅니다.
 *         help=1을 보내야 열 번호 목록이 응답에 들어옵니다.
 *         결측 표시 값(-9)은 analysis/config.ts의 kmaMissingSentinel을 씁니다.
 */

import { CONFIG } from '../analysis/config'
import { makeStageError, type StageError } from '../analysis/errors'
import { daysBetween } from '../analysis/dates'
import type { WeatherObs } from './types'

export interface DateChunk {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

const REQUIRED_COLUMNS = ['TM', 'TA_AVG', 'TA_MAX', 'TA_MIN', 'RN_DAY']

/** 기간을 chunkDays일 단위로 나눕니다. 마지막 조각은 짧을 수 있습니다. */
export function splitDateRange(start: string, end: string, chunkDays: number = CONFIG.asosChunkDays): DateChunk[] {
  const total = daysBetween(start, end) + 1
  const chunks: DateChunk[] = []
  for (let offset = 0; offset < total; offset += chunkDays) {
    const chunkStart = addDays(start, offset)
    const chunkEnd = addDays(start, Math.min(offset + chunkDays, total) - 1)
    chunks.push({ start: chunkStart, end: chunkEnd })
  }
  return chunks
}

/** YYYY-MM-DD → YYYYMMDD (KMA 요청 형식). */
export function toKmaDate(iso: string): string {
  return iso.replace(/-/g, '')
}

/** 요청 변수 (authKey 제외). help=1: 응답에 열 번호 목록을 넣습니다. */
export function buildAsosQuery(stationId: string, start: string, end: string): Record<string, string> {
  return { tm1: toKmaDate(start), tm2: toKmaDate(end), stn: stationId, help: '1' }
}

/** 응답 텍스트를 하루 관측값 목록으로 바꿉니다. 형식이 맞지 않으면 E_KMA_RESPONSE. */
export function parseAsosDaily(text: string, stationId: string): { ok: true; days: WeatherObs[] } | { ok: false; error: StageError } {
  const lines = text.split(/\r?\n/)
  const names = columnNames(lines)
  if (names.length === 0) {
    return { ok: false, error: responseError('응답에서 열 번호 목록("# 1. TM : ...")을 찾지 못했습니다.') }
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !names.includes(c))
  if (missing.length > 0) {
    return { ok: false, error: responseError(`응답에 필요한 열이 없습니다: ${missing.join(', ')}`) }
  }
  const tokens = dataTokens(lines)
  const n = names.length
  if (tokens.length % n !== 0) {
    return { ok: false, error: responseError('데이터 칸 수가 열 개수의 배수가 아닙니다.') }
  }
  const at = (row: string[], name: string) => row[names.indexOf(name)]!
  const days: WeatherObs[] = []
  for (let i = 0; i < tokens.length; i += n) {
    const row = tokens.slice(i, i + n)
    const date = toIsoFromKma(at(row, 'TM'))
    if (date === null) return { ok: false, error: responseError('응답의 날짜 형식을 읽을 수 없습니다.') }
    days.push({
      date,
      stationId,
      precipMm: precipFrom(at(row, 'RN_DAY'), parseKmaNumber(at(row, 'TA_AVG'))),
      tempAvg: parseKmaNumber(at(row, 'TA_AVG')),
      tempMax: parseKmaNumber(at(row, 'TA_MAX')),
      tempMin: parseKmaNumber(at(row, 'TA_MIN')),
      stale: false,
    })
  }
  return { ok: true, days }
}

/** "# 1. TM : 관측일 (KST)" 같은 줄에서 열 이름을 번호 순서대로 모읍니다. */
function columnNames(lines: string[]): string[] {
  const found: Array<{ no: number; name: string }> = []
  for (const line of lines) {
    const m = /^#\s*(\d+)\.\s+([A-Z][A-Z0-9_]*)\s*:/.exec(line)
    if (m) found.push({ no: Number(m[1]), name: m[2]! })
  }
  return found.sort((a, b) => a.no - b.no).map((f) => f.name)
}

/** 주석과 시작·끝 표시를 빼고 모든 값 칸을 한 줄로 모읍니다. */
function dataTokens(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t === '' || t.startsWith('#') || /START7777|7777END/.test(t)) continue
    out.push(...t.split(/\s+/))
  }
  return out
}

/** 값 하나를 숫자로 바꿉니다. 빈 칸, '-', 결측 표시 값(-9)은 null입니다. */
export function parseKmaNumber(token: string | undefined): number | null {
  if (token === undefined || token === '' || token === '-') return null
  const n = Number(token)
  if (!Number.isFinite(n)) return null
  if (n === CONFIG.kmaMissingSentinel) return null
  return n
}

/**
 * 일강수량: -9는 "비 기록 없음(무강수)"입니다. 2026-10 자료에서 RN_DUR, RN_60M, RN_10M도 같이 -9였고,
 * 실제 비가 온 날은 값이 찍혔습니다. 기온이 있는 날이면 0mm로 봅니다. 기온도 없으면 결측(null)입니다.
 */
export function precipFrom(token: string | undefined, tempAvg: number | null): number | null {
  const v = parseKmaNumber(token)
  if (v !== null) return v
  const isSentinel = token !== undefined && Number(token) === CONFIG.kmaMissingSentinel
  return isSentinel && tempAvg !== null ? 0 : null
}

/** 날짜 형식 YYYYMMDD → YYYY-MM-DD. */
function toIsoFromKma(token: string): string | null {
  if (!/^\d{8}$/.test(token)) return null
  return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`
}

function responseError(message: string): StageError {
  return makeStageError('weather.fetch', 'E_KMA_RESPONSE', message,
    '응답 형식이 바뀌었을 수 있습니다. npm run kma -- --save-raw 로 응답을 저장해 확인하세요.')
}

/** 날짜 문자열에 날 수를 더합니다 (UTC 기준). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
