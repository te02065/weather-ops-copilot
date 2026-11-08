/**
 * 이 파일이 하는 일: 날짜 문자열을 YYYY-MM-DD로 바꾸고, 요일을 구합니다.
 * 입력: 날짜 문자열 (예: "2026-03-01", "2026/3/1", "20260301", "2026. 3. 1.", "2026년 3월 1일", 엑셀 날짜 번호 "46082")
 * 출력: "2026-03-01" 형식 문자열, 또는 잘못된 날짜면 null. 요일은 0(일)~6(토).
 * 주의점: 요일은 UTC로 계산합니다. 그래야 사용자의 PC 시간대와 상관없이 같은 요일이 나옵니다
 *         (옛 코드의 new Date("2026-03-01").getDay()는 시간대에 따라 하루 밀릴 수 있었습니다).
 *         엑셀 날짜 번호는 1899-12-30을 0으로 셉니다. 허용 범위는 config.excelSerialRange입니다.
 */

import { CONFIG } from './config'

// 구분자가 있는 형식 (2026-3-1, 2026/03/01, 2026. 3. 1. 등). 구분자는 한 종류로 맞춰야 합니다.
const SEPARATED_PATTERN = /^(\d{4})\s*([-/.])\s*(\d{1,2})\s*\2\s*(\d{1,2})\s*\.?$/
// 한글 날짜 (2026년 3월 1일)
const KOREAN_PATTERN = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/
// 구분자 없는 8자리 형식 (20260301)
const COMPACT_PATTERN = /^(\d{4})(\d{2})(\d{2})$/
// 엑셀 날짜 번호 (5자리 정수)
const SERIAL_PATTERN = /^\d{5}$/

/** 허용 형식은 파일 맨 위 설명을 보세요. 실제로 없는 날짜(2월 30일)는 null. */
export function parseIsoDate(text: string): string | null {
  const t = text.trim()
  if (SERIAL_PATTERN.test(t)) return excelSerialToIso(Number(t)) ?? null
  const parts = partsOf(t)
  if (!parts) return null
  const [year, month, day] = parts as [number, number, number]
  const d = new Date(Date.UTC(year, month - 1, day))
  // 날짜를 만들었다가 다시 읽었을 때 같은 값이 아니면 없는 날짜입니다 (예: 2월 30일 → 3월 2일)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 년, 월, 일 숫자 세 개. 맞는 형식이 없으면 null. */
function partsOf(t: string): [number, number, number] | null {
  const sep = SEPARATED_PATTERN.exec(t)
  if (sep) return [Number(sep[1]), Number(sep[3]), Number(sep[4])]
  const ko = KOREAN_PATTERN.exec(t)
  if (ko) return [Number(ko[1]), Number(ko[2]), Number(ko[3])]
  const c = COMPACT_PATTERN.exec(t)
  return c ? [Number(c[1]), Number(c[2]), Number(c[3])] : null
}

/** 엑셀 날짜 번호 → YYYY-MM-DD. 허용 범위 밖이면 undefined (날짜 번호가 아니라는 뜻). */
function excelSerialToIso(n: number): string | undefined {
  const { min, max } = CONFIG.excelSerialRange
  if (n < min || n > max) return undefined
  const ms = Date.UTC(1899, 11, 30) + n * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** YYYY-MM-DD 문자열의 요일 (0=일요일 ... 6=토요일). UTC 기준. */
export function dayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay()
}

/** YYYY-MM-DD에 날 수를 더합니다 (UTC 기준). */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 두 날짜 사이의 날 수 차이 (b - a). 둘 다 YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** 오늘 날짜(사용자 기기의 로컬 시간 기준) YYYY-MM-DD. 화면에서 "과거 날짜인지" 볼 때 씁니다. */
export function localTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
