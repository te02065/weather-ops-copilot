/**
 * 이 파일이 하는 일: AWS 매분자료(nph-aws2_min) 응답을 읽고, 하루 강수량을 구합니다.
 * 입력: 응답 텍스트 (헤더 줄 "# YYMMDDHHMI STN ..."과 분 단위 데이터 줄)
 * 출력: 분 단위 행 목록, 하루 일강수량(RN-DAY)
 * 주의점: 결측은 -50 이하입니다 (명세서). ASOS의 -9와 다릅니다. 열 이름은 헤더 줄에서 읽습니다.
 *         하루 강수량은 그날 마지막 분의 RN-DAY(일 누적)입니다.
 */

import { CONFIG } from '../analysis/config'
import { makeStageError, type StageError } from '../analysis/errors'

export interface AwsMinuteRow {
  tm: string                        // YYYYMMDDHHMM (KST)
  stn: string
  values: Record<string, number | null> // 열 이름 → 값 (결측은 null)
}

export function parseAwsMinute(text: string): { ok: true; rows: AwsMinuteRow[] } | { ok: false; error: StageError } {
  const lines = text.split(/\r?\n/)
  const header = lines.find((l) => /^#\s*YYMMDDHHMI\s/.test(l))
  if (header === undefined) {
    return { ok: false, error: responseError('응답에서 열 이름 줄("# YYMMDDHHMI ...")을 찾지 못했습니다.') }
  }
  const names = header.replace(/^#\s*/, '').trim().split(/\s+/)
  const rows: AwsMinuteRow[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t === '' || t.startsWith('#') || /START7777|7777END/.test(t)) continue
    const cells = t.split(/\s+/)
    if (cells.length !== names.length) {
      return { ok: false, error: responseError('데이터 줄의 칸 수가 열 이름 줄과 맞지 않습니다.') }
    }
    const values: Record<string, number | null> = {}
    names.slice(2).forEach((name, i) => { values[name] = awsNumber(cells[i + 2]!) })
    rows.push({ tm: cells[0]!, stn: cells[1]!, values })
  }
  return { ok: true, rows }
}

/** 값 하나. 결측(-50 이하)과 빈 칸은 null입니다. */
export function awsNumber(token: string): number | null {
  const n = Number(token)
  if (!Number.isFinite(n)) return null
  return n <= CONFIG.awsMissingLimit ? null : n
}

/**
 * 하루 강수량: 일 누적(RN-DAY)의 하루 최댓값입니다. 마지막 분 값을 쓰면 안 됩니다 (일부 지점은 끝에서 0으로 떨어짐).
 * 해당 날짜 자료가 없으면 null.
 */
export function awsDailyPrecip(rows: AwsMinuteRow[], date: string): number | null {
  const day = rowsOfDay(rows, date)
  if (day.length === 0) return null
  const values = day.map((r) => r.values['RN-DAY']).filter((v): v is number => v !== null && v !== undefined)
  return values.length === 0 ? null : Math.max(...values)
}

/** 하루 자료의 분 수와, 강수가 감지된 분 수. 1,440분이 아니면 자료가 빠진 것입니다. */
export function awsDayCoverage(rows: AwsMinuteRow[], date: string): { minutes: number; rainDetected: number } {
  const day = rowsOfDay(rows, date)
  return { minutes: day.length, rainDetected: day.filter((r) => r.values['RE'] === 1).length }
}

function rowsOfDay(rows: AwsMinuteRow[], date: string): AwsMinuteRow[] {
  const ymd = date.replace(/-/g, '')
  return rows.filter((r) => r.tm.startsWith(ymd))
}

function responseError(message: string): StageError {
  return makeStageError('weather.fetch', 'E_KMA_RESPONSE', message,
    '응답 형식이 바뀌었을 수 있습니다. 원문을 저장해 열 이름을 확인하세요.')
}
