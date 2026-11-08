/**
 * 이 파일이 하는 일: 설계서 F4의 "경고·정보" 코드(W_..., I_...)를 만듭니다. 경고는 분석을 막지 않습니다.
 * 입력: SalesInputRow 배열, 파일 헤더 목록, 열 매핑
 * 출력: StageError 배열 (W_ 또는 I_로 시작하는 code)
 * 주의점: 매출 0원은 "휴무 후보"일 뿐 사용자가 확정하기 전에는 삭제하지 않습니다 (설계 F4).
 *         이상치도 플래그만 답니다. 메시지에 매출 금액은 넣지 않습니다.
 *         선택 열을 지정했는데 파일에 없으면 I_OPTIONAL_MISSING을 남기고 그 열은 무시합니다 (차단하지 않음).
 */

import { daysBetween } from './dates'
import { makeStageError, type StageError } from './errors'
import type { ColumnMapping, SalesInputRow } from './types'

/** W_GAPS: 첫 날짜와 마지막 날짜 사이에서 빠진 날짜가 있으면 알려 줍니다. */
export function checkGaps(rows: SalesInputRow[]): StageError[] {
  if (rows.length < 2) return []
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort()
  const span = daysBetween(dates[0]!, dates[dates.length - 1]!) + 1
  const missing = span - dates.length
  if (missing <= 0) return []
  const present = new Set(dates)
  let firstMissing = ''
  for (let i = 0; i < span && !firstMissing; i++) {
    const d = addDays(dates[0]!, i)
    if (!present.has(d)) firstMissing = d
  }
  return [makeStageError('ingest.validate', 'W_GAPS',
    `날짜가 ${missing}일 빠져 있습니다 (첫 누락일 ${firstMissing}).`,
    '빠진 날짜가 휴무인지 확인하세요. 휴무라면 그대로 두어도 됩니다.')]
}

/**
 * 경고 메시지에 넣는 행 위치 표기 방법. 기본은 파일 줄 번호와 날짜입니다.
 * POS 엑셀에서 온 행은 시트 이름과 날짜를 넣습니다 (앱이 만든 임시 CSV의 줄 번호는 엑셀 줄과 다릅니다).
 */
export type RowLabel = (row: SalesInputRow) => string
export const csvRowLabel: RowLabel = (r) => `파일 ${r.row}번째 줄 (${r.date})`

/** W_ZERO_SALES: 매출 0원인 행마다 "휴무 후보"로 알려 줍니다. */
export function zeroSalesWarnings(rows: SalesInputRow[], label: RowLabel = csvRowLabel): StageError[] {
  return rows
    .filter((r) => r.sales === 0)
    .map((r) => makeStageError('ingest.validate', 'W_ZERO_SALES',
      `${label(r)}: 매출 0원입니다. 휴무 후보로 표시합니다.`,
      '휴무가 맞으면 확정하세요. 영업을 했는데 0원이면 원본 파일을 확인하세요.', r.row))
}

/** W_OUTLIER: 이상치 행마다 경고를 만듭니다. 자동으로 지우지 않습니다. */
export function outlierWarnings(outlierRows: SalesInputRow[], label: RowLabel = csvRowLabel): StageError[] {
  return outlierRows.map((r) => makeStageError('ingest.validate', 'W_OUTLIER',
    `${label(r)}: 평소보다 많이 팔린 날이에요. 명절이나 공휴일이면 정상입니다.`,
    '명절·공휴일이 아니라면 특별한 행사가 있었는지 확인하세요. 빼고 싶으면 알려 주세요.', r.row))
}

/** W_NO_TRANSACTIONS (정보): 거래 수 열이 없을 때 알려 줍니다. */
export function transactionsWarning(hasTransactions: boolean): StageError[] {
  if (hasTransactions) return []
  return [makeStageError('ingest.validate', 'W_NO_TRANSACTIONS',
    '거래 수 열이 없어서 거래 수 관련 정보는 계산하지 않습니다.',
    '거래 수 열이 있다면 매핑 화면에서 고르세요. 없어도 분석은 됩니다.')]
}

/**
 * I_OPTIONAL_MISSING (정보): 선택 열을 골랐는데 파일 헤더에 없으면 알려 줍니다.
 * 그 열은 값 없음(null)으로 두고 분석은 계속합니다.
 */
export function optionalMissingInfo(fields: string[], mapping: ColumnMapping): StageError[] {
  const chosen: Array<[string, string | undefined]> = [
    ['거래 수', mapping.transactions],
    ['아이스 매출', mapping.iceSales],
    ['핫 매출', mapping.hotSales],
  ]
  return chosen
    .filter(([, column]) => column !== undefined && column !== '' && !fields.includes(column))
    .map(([label, column]) => makeStageError('ingest.validate', 'I_OPTIONAL_MISSING',
      `선택 열 '${column}'(${label})가 파일 헤더에 없어서 무시합니다.`,
      `필요하면 헤더 이름을 확인하거나 매핑에서 '${label}' 열을 비우세요.`))
}

/** 날짜 문자열에 날 수를 더합니다 (UTC 기준). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
