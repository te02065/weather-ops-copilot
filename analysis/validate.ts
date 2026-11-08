/**
 * 이 파일이 하는 일: 설계서 F4의 "오류" 검증 코드(E_...)를 확인합니다.
 * 입력: 파일 헤더 목록, 열 매핑, 파싱된 행 목록
 * 출력: StageError 배열 (비어 있으면 통과)
 * 주의점: 오류 메시지에는 매출 금액을 넣지 않습니다. 열 이름과 행 번호만 씁니다.
 *         기준 숫자(최소 영업일 56일)는 analysis/config.ts에서만 가져옵니다.
 */

import { CONFIG } from './config'
import { atLine, makeStageError, type StageError } from './errors'
import type { ColumnMapping, SalesInputRow } from './types'

/** 열 지정 확인: 필수 열(날짜, 매출)이 지정됐는지, 헤더에 있는지 봅니다. */
export function checkMapping(fields: string[], mapping: ColumnMapping): StageError[] {
  const errors: StageError[] = []
  if (mapping.date === '') {
    errors.push(makeStageError('ingest.validate', 'E_NO_DATE_COL',
      '날짜 열이 지정되지 않았습니다.', '매핑 화면에서 날짜 열을 고르세요.'))
  } else if (!fields.includes(mapping.date)) {
    errors.push(makeStageError('ingest.validate', 'E_NO_DATE_COL',
      `지정한 날짜 열 '${mapping.date}'가 파일 헤더에 없습니다.`,
      `CSV 첫 줄(헤더)에 '${mapping.date}'가 있는지 확인하거나 다른 열을 고르세요.`))
  }
  if (mapping.sales === '') {
    errors.push(makeStageError('ingest.validate', 'E_NO_SALES_COL',
      '매출 열이 지정되지 않았습니다.', '매핑 화면에서 매출 열을 고르세요.'))
  } else if (!fields.includes(mapping.sales)) {
    errors.push(makeStageError('ingest.validate', 'E_NO_SALES_COL',
      `지정한 매출 열 '${mapping.sales}'가 파일 헤더에 없습니다.`,
      `CSV 첫 줄(헤더)에 '${mapping.sales}'가 있는지 확인하거나 다른 열을 고르세요.`))
  }
  return errors
}

/** 음수 매출 확인. 0은 여기서 다루지 않습니다 (휴무 후보는 warnings.ts). */
export function checkNegativeSales(rows: SalesInputRow[]): StageError[] {
  return rows
    .filter((r) => r.sales !== null && r.sales < 0)
    .map((r) => makeStageError('ingest.validate', 'E_NEGATIVE',
      `매출이 음수인 행이 있습니다 (${atLine(r.row)}, 열 'sales').`,
      '환불·취소분을 제외하거나 원본 파일에서 음수 행을 확인하세요.', r.row))
}

/** 같은 날짜가 두 번 이상 나오면 두 번째부터 오류로 기록합니다. */
export function checkDuplicateDates(rows: SalesInputRow[]): StageError[] {
  const seen = new Set<string>()
  const errors: StageError[] = []
  for (const r of rows) {
    if (seen.has(r.date)) {
      errors.push(makeStageError('ingest.validate', 'E_DUP_DATE',
        `날짜 ${r.date}가 두 번 이상 있습니다 (${atLine(r.row)}).`,
        '같은 날짜의 행을 하나로 합치거나 중복 행을 지우세요.', r.row))
    }
    seen.add(r.date)
  }
  return errors
}

/** 유효 영업일(매출 > 0인 날)이 최소 기준보다 적으면 E_TOO_SHORT 오류입니다. */
export function checkMinLength(rows: SalesInputRow[]): StageError[] {
  const validDays = rows.filter((r) => r.sales !== null && r.sales > 0).length
  if (validDays >= CONFIG.minTrainDays) return []
  return [makeStageError('ingest.validate', 'E_TOO_SHORT',
    `유효 영업일이 ${validDays}일로 최소 기준 ${CONFIG.minTrainDays}일보다 적습니다.`,
    '더 긴 기간의 매출 파일을 준비하세요.')]
}
