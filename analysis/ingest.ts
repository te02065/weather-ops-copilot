/**
 * 이 파일이 하는 일: CSV 읽기 → 열 확인 → 행 만들기 → 오류 검증 → 경고 만들기를 순서대로 실행합니다.
 * 입력: CSV 문자열, ColumnMapping (사용자가 고른 열)
 * 출력: IngestResult { ok, rows, errors, warnings, summary }
 * 주의점: 단계마다 logger로 오류·경고를 남깁니다. 로그에는 매출 값이 들어가지 않습니다.
 *         시작 로그(파일 해시 포함)는 실행 스크립트(scripts/runAnalysis.ts)가 남깁니다.
 *         오류가 나면 그 단계에서 멈춥니다. 예: 헤더 읽기 실패면 날짜 검사는 하지 않습니다.
 */

import { log } from './logger'
import { readCsvText, buildRows } from './csv'
import { decodeCsvBytes } from './encoding'
import { makeStageError } from './errors'
import { checkMapping, checkNegativeSales, checkDuplicateDates, checkMinLength } from './validate'
import { checkGaps, zeroSalesWarnings, outlierWarnings, transactionsWarning, optionalMissingInfo, csvRowLabel, type RowLabel } from './warnings'
import { findOutlierRows } from './outliers'
import type { StageError } from './errors'
import type { ColumnMapping, IngestResult, IngestSummary, SalesInputRow } from './types'

/**
 * 파일 원본 바이트를 받는 입구. UTF-8(BOM 포함)과 CP949를 자동으로 판별합니다.
 * 읽은 인코딩은 I_ENCODING(정보)으로 기록합니다. 둘 다 실패하면 E_CSV_PARSE입니다.
 */
export function ingestSalesCsvBytes(bytes: Uint8Array, mapping: ColumnMapping): IngestResult {
  const decoded = decodeCsvBytes(bytes)
  if (!decoded.ok) {
    const error = makeStageError('ingest.parse', 'E_CSV_PARSE',
      '파일을 UTF-8과 CP949로 모두 읽지 못했습니다.',
      '엑셀에서 "CSV UTF-8" 또는 "CSV(쉼표로 분리)"로 다시 저장한 뒤 올리세요.')
    logItems('ingest.parse', 'error', [error])
    return failResult([error])
  }
  const encodingInfo = makeStageError('ingest.parse', 'I_ENCODING',
    `파일을 ${decoded.encoding} 인코딩으로 읽었습니다.`,
    '글자가 깨져 보이면 이 줄을 먼저 확인하세요.')
  const result = ingestSalesCsv(decoded.text, mapping)
  logItems('ingest.parse', 'warn', [encodingInfo])
  return { ...result, warnings: [encodingInfo, ...result.warnings] }
}

/** label: 경고에 넣을 행 위치 표기. 생략하면 파일 줄 번호와 날짜를 씁니다. */
export function ingestSalesCsv(text: string, mapping: ColumnMapping, label: RowLabel = csvRowLabel): IngestResult {
  const startedAt = Date.now()
  const parsed = readCsvText(text)
  logItems('ingest.parse', 'error', parsed.errors)
  log('ingest.parse', 'end', { outCount: parsed.records.length, ms: Date.now() - startedAt })
  if (parsed.errors.length > 0) return failResult(parsed.errors)

  log('ingest.validate', 'start', { inCount: parsed.records.length })
  const mappingErrors = checkMapping(parsed.fields, mapping)
  if (mappingErrors.length > 0) return finishValidation(mappingErrors, [], [])

  const built = buildRows(parsed.records, mapping)
  const errors = [
    ...built.errors,
    ...checkNegativeSales(built.rows),
    ...checkDuplicateDates(built.rows),
    ...checkMinLength(built.rows),
  ]
  const rows = applyFlags(built.rows)
  const hasTransactions = Boolean(mapping.transactions) && parsed.fields.includes(mapping.transactions ?? '')
  const warnings = [
    ...optionalMissingInfo(parsed.fields, mapping),
    ...checkGaps(rows),
    ...zeroSalesWarnings(rows, label),
    ...outlierWarnings(rows.filter((r) => r.flags.includes('outlier_candidate')), label),
    ...transactionsWarning(hasTransactions),
  ]
  return finishValidation(errors, warnings, rows)
}

/** 휴무 후보(매출 0원)와 이상치 후보에 표시를 붙입니다. 원래 행은 지우지 않습니다. */
function applyFlags(rows: SalesInputRow[]): SalesInputRow[] {
  const outliers = new Set(findOutlierRows(rows))
  return rows.map((r) => {
    const flags: string[] = []
    if (r.sales === 0) flags.push('closed_candidate')
    if (outliers.has(r.row)) flags.push('outlier_candidate')
    return { ...r, flags }
  })
}

function finishValidation(errors: StageError[], warnings: StageError[], rows: SalesInputRow[]): IngestResult {
  logItems('ingest.validate', 'error', errors)
  logItems('ingest.validate', 'warn', warnings)
  log('ingest.validate', 'end', { outCount: rows.length })
  return { ok: errors.length === 0, rows, errors, warnings, summary: summarize(rows) }
}

function failResult(errors: StageError[]): IngestResult {
  return { ok: false, rows: [], errors, warnings: [], summary: summarize([]) }
}

/** 요약 숫자. 날짜 목록이나 매출 목록은 넣지 않습니다. */
function summarize(rows: SalesInputRow[]): IngestSummary {
  const dates = rows.map((r) => r.date).sort()
  return {
    rowCount: rows.length,
    dateStart: dates[0] ?? null,
    dateEnd: dates[dates.length - 1] ?? null,
    validDays: rows.filter((r) => r.sales !== null && r.sales > 0).length,
    zeroDays: rows.filter((r) => r.sales === 0).length,
    missingSalesCells: rows.filter((r) => r.sales === null).length,
    hasTransactions: rows.some((r) => r.transactions !== null),
    hasIceSales: rows.some((r) => r.iceSales !== null),
    hasHotSales: rows.some((r) => r.hotSales !== null),
  }
}

function logItems(stage: 'ingest.parse' | 'ingest.validate', event: 'error' | 'warn', items: StageError[]): void {
  for (const item of items) {
    log(stage, event, { code: item.code, message: item.message, hint: item.hint })
  }
}
