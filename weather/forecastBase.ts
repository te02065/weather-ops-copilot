/**
 * 이 파일이 하는 일: 지금 받을 수 있는 가장 최근 단기예보 발표 시각을 고르고, 목표일의 예보 시각 목록을 만듭니다.
 * 입력: 현재 시각 (밀리초), 목표일 (YYYY-MM-DD)
 * 출력: 발표일자(YYYYMMDD)와 발표시각(HHMM), 목표일 0~23시의 예보 시각 목록(YYYYMMDDHHMM)
 * 주의점: 시각은 모두 한국 시간(KST, UTC+9) 기준입니다. 발표 후 10분 전에는 그 발표를 쓰지 않습니다.
 *         발표 시각과 10분 규칙은 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from '../analysis/config'

export interface BaseTime { baseDate: string; baseTime: string }

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 지금 받을 수 있는 가장 최근 발표. 오늘 첫 발표 전이면 어제 마지막(23시) 발표를 씁니다. */
export function latestBase(nowMs: number): BaseTime {
  const kst = new Date(nowMs + KST_OFFSET_MS)
  const minutesNow = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  const ready = CONFIG.forecastBaseHours.filter((h) => h * 60 + CONFIG.forecastReadyMinutes <= minutesNow)
  if (ready.length > 0) {
    return { baseDate: ymd(kst), baseTime: `${pad(ready[ready.length - 1]!)}00` }
  }
  const yesterday = new Date(kst.getTime() - 24 * 60 * 60 * 1000)
  const last = CONFIG.forecastBaseHours[CONFIG.forecastBaseHours.length - 1]!
  return { baseDate: ymd(yesterday), baseTime: `${pad(last)}00` }
}

/**
 * 목표일 하루 전체를 덮는 발표 고르기. 목표일 0시(KST) 전에 나온 가장 최근 발표를 씁니다.
 * 이유: 발표 시각 이전의 시간은 예보가 없어서, 발표가 늦으면 하루 중 앞부분이 비어 버립니다.
 */
export function baseForTarget(nowMs: number, targetIso: string): BaseTime {
  const [y, m, d] = targetIso.split('-').map(Number)
  const targetStartMs = Date.UTC(y!, m! - 1, d!) - KST_OFFSET_MS
  return latestBase(Math.min(nowMs, targetStartMs - 1))
}

/** 목표일 0시부터 23시까지의 예보 시각 (YYYYMMDDHHMM). */
export function targetHours(targetIso: string): string[] {
  const day = targetIso.replace(/-/g, '')
  return Array.from({ length: CONFIG.forecastHoursPerDay }, (_, h) => `${day}${pad(h)}00`)
}

/** 발표일자(YYYYMMDD)를 YYYY-MM-DD로. */
export function baseDateIso(base: BaseTime): string {
  const d = base.baseDate
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
