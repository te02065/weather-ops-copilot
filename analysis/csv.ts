/**
 * 이 파일이 하는 일: CSV 텍스트를 읽고, 사용자가 고른 열 매핑대로 행을 만듭니다.
 * 입력: CSV 문자열, ColumnMapping (열 이름은 사용자가 고른 값)
 * 출력: 헤더 목록, 레코드 목록(각 레코드는 파일의 실제 줄 번호를 가짐), 파싱 오류, SalesInputRow 배열
 * 주의점: 열 이름을 자동으로 찾지 않습니다 (설계 F4). 날짜·숫자 형식이 틀린 행은 오류로 기록하고,
 *         그 칸의 값은 0으로 바꾸지 않습니다. 빈 칸은 0이 아니라 null(결측)입니다.
 *         줄 번호는 엑셀에서 보이는 번호와 같습니다 (헤더가 1번째 줄). 빈 줄은 건너뛰되 번호는 세서 유지합니다.
 *         E_CSV_PARSE는 "파일 전체를 읽지 못함"에만 씁니다. 개별 칸 오류는 E_BAD_* 를 씁니다.
 */

import { parse } from 'papaparse'
import { atLine, makeStageError, type StageError } from './errors'
import { parseIsoDate } from './dates'
import type { ColumnMapping, SalesInputRow } from './types'

/** 파일에서 읽은 한 줄. line은 엑셀 기준 줄 번호입니다. */
export interface CsvRecord {
  line: number
  values: Record<string, string>
}

export interface CsvReadResult {
  fields: string[]     // 헤더 열 이름 목록
  records: CsvRecord[] // 빈 줄을 뺀 데이터 행
  errors: StageError[]
}

/** CSV 텍스트를 읽습니다. 헤더는 첫 줄입니다. */
export function readCsvText(text: string): CsvReadResult {
  // 헤더 앞의 빈 줄은 헤더로 잘못 읽히므로 먼저 지웁니다. 지운 줄 수만큼 줄 번호를 보정합니다.
  const leading = /^(?:[ \t]*\r?\n)+/.exec(text)
  const leadingLines = leading ? (leading[0].match(/\n/g) ?? []).length : 0
  const body = leading ? text.slice(leading[0].length) : text
  // skipEmptyLines를 끄고 직접 빈 줄을 뺍니다. 그래야 줄 번호가 물리 줄과 맞습니다.
  // 구분자는 쉼표로 고정합니다. 자동 감지는 빈 줄이 있을 때 실패할 수 있습니다.
  const result = parse<Record<string, string>>(body, { header: true, skipEmptyLines: false, delimiter: ',' })
  // 빈 줄은 papaparse가 "열 개수 불일치"로 알려 주지만, 빈 줄은 건너뛰므로 오류가 아닙니다
  const blankIndex = new Set(result.data.flatMap((v, i) => (isBlank(v) ? [i] : [])))
  const realErrors = result.errors.filter((e) => e.row === undefined || !blankIndex.has(e.row))
  const errors: StageError[] = realErrors.map((e) =>
    makeStageError(
      'ingest.parse',
      'E_CSV_PARSE',
      `파일을 읽는 중 형식 오류가 있습니다: ${e.message}`,
      '파일이 CSV인지, 쉼표와 따옴표가 맞는지 확인하세요.',
      e.row === undefined ? undefined : e.row + 2 + leadingLines,
    ),
  )
  if (text.includes('�')) {
    errors.push(makeStageError('ingest.parse', 'E_CSV_PARSE',
      '파일의 글자가 깨져 있습니다 (인코딩 오류).',
      '엑셀에서 "CSV UTF-8"로 다시 저장한 뒤 올리세요.'))
  }
  const records: CsvRecord[] = []
  result.data.forEach((values, i) => {
    if (isBlank(values)) return // 빈 줄은 건너뜁니다
    records.push({ line: i + 2 + leadingLines, values }) // +2: 헤더가 1번째 줄, 배열은 0부터 시작
  })
  if (records.length === 0 && errors.length === 0) {
    errors.push(
      makeStageError('ingest.parse', 'E_CSV_PARSE', '데이터 행이 하나도 없습니다.', '헤더 아래에 매출 행이 있는지 확인하세요.'),
    )
  }
  return { fields: result.meta.fields ?? [], records, errors }
}

/** 모든 칸이 비어 있으면 빈 줄입니다. */
function isBlank(values: Record<string, string>): boolean {
  return Object.values(values).every((v) => (v ?? '').trim() === '')
}

/** 숫자 칸 하나를 읽습니다. 쉼표(1,234,000)는 허용합니다. 비어 있으면 값 없음(null)입니다. */
export function parseAmount(text: string | undefined): { value: number | null; bad: boolean } {
  const t = (text ?? '').trim().replace(/,/g, '')
  if (t === '') return { value: null, bad: false }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { value: null, bad: true }
  return { value: Number(t), bad: false }
}

/** 한 칸의 숫자를 읽어 값을 돌려주고, 잘못된 칸이면 오류 목록에 추가합니다. */
function readOptionalAmount(
  record: CsvRecord,
  column: string | undefined,
  label: string,
  errors: StageError[],
): number | null {
  if (!column) return null
  const { value, bad } = parseAmount(record.values[column])
  if (bad) {
    errors.push(
      makeStageError('ingest.validate', 'E_BAD_NUMBER',
        `'${column}' 열(${atLine(record.line)})의 ${label} 숫자를 읽을 수 없습니다.`,
        `'${column}' 열에 쉼표나 글자 없이 숫자만 넣었는지 확인하세요.`, record.line),
    )
  }
  return value
}

/**
 * 레코드를 SalesInputRow로 바꿉니다. 열 매핑이 맞다는 것은 validate.ts에서 먼저 확인합니다.
 * 날짜가 틀리면 E_BAD_DATE를 기록하고 그 행은 건너뜁니다.
 * 숫자가 틀리면 E_BAD_NUMBER를 기록하고 그 칸만 null(값 없음)로 둡니다. 행은 남깁니다.
 */
export function buildRows(
  records: CsvRecord[],
  mapping: ColumnMapping,
): { rows: SalesInputRow[]; errors: StageError[] } {
  const rows: SalesInputRow[] = []
  const errors: StageError[] = []
  for (const record of records) {
    const date = parseIsoDate(record.values[mapping.date] ?? '')
    if (date === null) {
      errors.push(
        makeStageError('ingest.validate', 'E_BAD_DATE',
          `'${mapping.date}' 열(${atLine(record.line)})의 날짜 형식을 읽을 수 없습니다.`,
          '날짜를 2026-03-01 또는 2026/3/1 형식으로 고치세요.', record.line),
      )
      continue
    }
    const sales = readOptionalAmount(record, mapping.sales, '매출', errors)
    const transactions = readOptionalAmount(record, mapping.transactions, '거래 수', errors)
    const iceSales = readOptionalAmount(record, mapping.iceSales, '아이스 매출', errors)
    const hotSales = readOptionalAmount(record, mapping.hotSales, '핫 매출', errors)
    rows.push({ row: record.line, date, sales, transactions, iceSales, hotSales, flags: [] })
  }
  return { rows, errors }
}
