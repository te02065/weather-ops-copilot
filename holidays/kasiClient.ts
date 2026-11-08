import 'server-only'
/**
 * 이 파일이 하는 일: 한국천문연구원 특일 API에서 기간 안의 공휴일을 월 단위로 받아 모읍니다.
 * 입력: 시작일, 종료일 (YYYY-MM-DD), 인증키 (KASI_API_KEY)
 * 출력: 공휴일 목록, 또는 오류 (키 값은 가립니다)
 * 주의점: 서버에서만 실행됩니다. 키는 .env.local의 KASI_API_KEY에서만 읽습니다.
 *         자동 테스트는 이 함수를 부르지 않습니다. 형식 검사는 holidays/kasi.ts에서 합니다.
 */

import { makeStageError, type StageError } from '../analysis/errors'
import { buildRestDeUrl, monthsBetween, parseRestDeJson, redactServiceKey, type HolidayItem, type HolidayResult } from './kasi'

export const KASI_KEY_NAME = 'KASI_API_KEY'

export type KasiKeyResult = { ok: true; key: string } | { ok: false; error: StageError }

export function readKasiKey(env: Record<string, string | undefined> = process.env): KasiKeyResult {
  const key = (env[KASI_KEY_NAME] ?? '').trim()
  if (key === '') {
    return {
      ok: false,
      error: makeStageError('holiday.fetch', 'E_HOLIDAY_KEY_MISSING',
        'KASI_API_KEY가 .env.local에 없습니다',
        '.env.local 파일에 KASI_API_KEY=발급받은키 한 줄을 추가하고 서버를 다시 실행하세요.'),
    }
  }
  return { ok: true, key }
}

/** 기간 안의 공휴일을 돌려줍니다. 기간은 날짜 순서가 맞아야 하고 최대 개월 수 안이어야 합니다. */
export async function fetchHolidays(start: string, end: string, key: string): Promise<HolidayResult> {
  const months = monthsBetween(start, end)
  if (months === null || start > end) {
    return {
      ok: false,
      error: makeStageError('holiday.fetch', 'E_HOLIDAY_RANGE',
        '공휴일 조회 기간이 잘못됐거나 너무 깁니다',
        '시작일이 종료일보다 앞이고, 24개월 이내인지 확인하세요.'),
    }
  }
  const holidays: HolidayItem[] = []
  for (const ym of months) {
    const one = await fetchMonth(ym.year, ym.month, key)
    if (!one.ok) return one
    holidays.push(...one.holidays)
  }
  return { ok: true, holidays: holidays.filter((h) => h.date >= start && h.date <= end) }
}

async function fetchMonth(year: number, month: number, key: string): Promise<HolidayResult> {
  const url = buildRestDeUrl({ year, month }, key)
  try {
    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        error: makeStageError('holiday.fetch', 'E_HOLIDAY_FETCH',
          `특일 API 요청 실패: HTTP ${res.status}`,
          res.status === 401 || res.status === 403
            ? '공공데이터포털에서 "한국천문연구원_특일 정보" 활용신청이 승인됐는지, 인증키가 맞는지 확인하세요.'
            : '인터넷 연결을 확인하세요.'),
      }
    }
    return parseRestDeJson(redactServiceKey(text, key))
  } catch (err) {
    return {
      ok: false,
      error: makeStageError('holiday.fetch', 'E_HOLIDAY_FETCH',
        `특일 API 요청 중 오류: ${redactServiceKey(err instanceof Error ? err.message : String(err), key)}`,
        '인터넷 연결을 확인하세요.'),
    }
  }
}
