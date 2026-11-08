/**
 * 이 파일이 하는 일: 한국천문연구원 특일 정보(getRestDeInfo, JSON) 응답을 읽어 공휴일 날짜 목록으로 만듭니다.
 * 입력: 연·월 목록, 응답 JSON 문자열, 인증키
 * 출력: 조회 주소, 공휴일 목록 { date: 'YYYY-MM-DD', name }, 또는 오류
 * 주의점: isHoliday가 'Y'인 항목만 씁니다. 대체공휴일은 dateName "대체공휴일(...)"으로 옵니다.
 *         제헌절은 이 API에 없습니다. 자료가 없는 달은 items가 빈 문자열("")로 옵니다.
 *         키는 이미 URL 인코딩된 값(%2F 등)이 있으면 그대로, 없으면 인코딩해서 씁니다.
 */

import { CONFIG } from '../analysis/config'
import { makeStageError, type StageError } from '../analysis/errors'

export const KASI_REST_DE_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

export interface HolidayItem { date: string; name: string }
export type HolidayResult = { ok: true; holidays: HolidayItem[] } | { ok: false; error: StageError }

export interface YearMonth { year: number; month: number }

/** 시작일과 종료일(포함) 사이의 연·월 목록. 최대 개월 수(CONFIG.holidayMaxMonths)를 넘으면 null입니다. */
export function monthsBetween(start: string, end: string): YearMonth[] | null {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const months: YearMonth[] = []
  let y = sy!
  let m = sm!
  while (y < ey! || (y === ey && m <= em!)) {
    months.push({ year: y, month: m })
    if (months.length > CONFIG.holidayMaxMonths) return null
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

/** 조회 주소. 키가 이미 인코딩되어 있으면(%가 있으면) 그대로 씁니다. */
export function buildRestDeUrl(ym: YearMonth, key: string): string {
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const month = String(ym.month).padStart(2, '0')
  return `${KASI_REST_DE_URL}?ServiceKey=${serviceKey}&solYear=${ym.year}&solMonth=${month}&_type=json&numOfRows=100`
}

/** 응답 JSON 한 달치를 읽습니다. 공휴일(isHoliday='Y')만 돌려줍니다. */
export function parseRestDeJson(text: string): HolidayResult {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return responseError('특일 응답을 JSON으로 읽지 못했습니다.')
  }
  const response = (body as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: unknown } } }).response
  if (!response?.header) return responseError('특일 응답 형식이 예상과 다릅니다.')
  if (response.header.resultCode !== '00') {
    return {
      ok: false,
      error: makeStageError('holiday.fetch', 'E_HOLIDAY_RESPONSE',
        `특일 API 오류: ${response.header.resultCode} ${response.header.resultMsg ?? ''}`.trim(),
        '공공데이터포털에서 이 API의 활용신청 상태와 인증키를 확인하세요.'),
    }
  }
  const items = response.body?.items
  if (items === '' || items === undefined || items === null) return { ok: true, holidays: [] }
  const list = (items as { item?: unknown }).item
  const rows = Array.isArray(list) ? list : list === undefined ? [] : [list]
  const holidays: HolidayItem[] = []
  for (const row of rows as Array<{ isHoliday?: string; locdate?: number | string; dateName?: string }>) {
    if (row.isHoliday !== 'Y') continue
    const raw = String(row.locdate ?? '')
    if (!/^\d{8}$/.test(raw)) return responseError('특일 응답의 날짜 형식이 예상과 다릅니다.')
    holidays.push({ date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, name: row.dateName ?? '' })
  }
  return { ok: true, holidays }
}

/** 오류 메시지에 키가 섞이지 않도록 가립니다. */
export function redactServiceKey(text: string, key: string): string {
  if (key === '') return text
  return text.split(key).join('***').split(encodeURIComponent(key)).join('***')
}

function responseError(message: string): HolidayResult {
  return {
    ok: false,
    error: makeStageError('holiday.fetch', 'E_HOLIDAY_RESPONSE', message,
      '응답 형식이 바뀌었을 수 있습니다. 잠시 후 다시 시도하거나 공휴일을 직접 입력하세요.'),
  }
}
