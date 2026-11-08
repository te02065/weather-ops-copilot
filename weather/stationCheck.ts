/**
 * 이 파일이 하는 일: 기상청 지점정보 CSV(ASOS, AWS)에 문제가 없는지 검사합니다.
 * 입력: CSV 텍스트 (UTF-8로 바꾼 파일), 지점 종류("ASOS" 또는 "AWS")
 * 출력: 요약 숫자와 문제 목록 (사람이 읽을 한국어 문장)
 * 주의점: 검사만 합니다. 파일을 고치지 않습니다. 빈 줄과 줄 끝 공백은 읽을 때 지워서 오류로 치지 않습니다.
 *         문제가 있는 행은 지점번호와 줄 번호로 알려 줍니다. 좌표 범위는 analysis/config.ts의 stationBounds를 씁니다.
 */

import { readCsvText } from '../analysis/csv'
import { CONFIG } from '../analysis/config'

export type StationKind = 'ASOS' | 'AWS'

export interface StationCheckReport {
  kind: StationKind
  totalRows: number
  activeRows: number          // 종료일이 없는 행 (현재 운영 중)
  activeIds: number           // 현재 운영 중인 지점 수
  activeWithRainGauge: number // 운영 중 행 가운데 강우계 높이가 기록된 행
  issues: string[]            // 문제 목록 (없으면 빈 배열)
}

const REQUIRED = ['지점', '시작일', '종료일', '지점명', '위도', '경도']
const RAIN_COLUMN = '강우계(관측장비지상높이(m))'

export function checkStationCsv(text: string, kind: StationKind): StationCheckReport {
  const read = readCsvText(text)
  const issues: string[] = read.errors.map((e) => `[${e.code}] ${e.message}`)
  const missingColumns = REQUIRED.filter((c) => !read.fields.includes(c))
  if (missingColumns.length > 0) issues.push(`필수 열이 없습니다: ${missingColumns.join(', ')}`)

  const rows = read.records.map((r) => ({ line: r.line, v: trimAll(r.values) }))
  const active = rows.filter((r) => (r.v['종료일'] ?? '') === '')
  const activeIdCount = new Map<string, number>()
  for (const r of active) {
    const id = r.v['지점'] ?? ''
    activeIdCount.set(id, (activeIdCount.get(id) ?? 0) + 1)
  }
  for (const [id, n] of Array.from(activeIdCount.entries())) {
    if (n > 1) issues.push(`지점 ${id}: 운영 중인 행이 ${n}개입니다 (하나만 있어야 함)`)
  }
  for (const r of rows) issues.push(...rowIssues(r.v, r.line))

  return {
    kind,
    totalRows: rows.length,
    activeRows: active.length,
    activeIds: activeIdCount.size,
    activeWithRainGauge: active.filter((r) => (r.v[RAIN_COLUMN] ?? '') !== '').length,
    issues,
  }
}

/** 한 행의 좌표와 번호를 검사합니다. */
function rowIssues(v: Record<string, string>, line: number): string[] {
  const out: string[] = []
  const id = v['지점'] ?? ''
  const label = `지점 ${id || '(번호 없음)'} (${line}번째 줄)`
  if (!/^\d+$/.test(id)) out.push(`${label}: 지점 번호가 숫자가 아닙니다`)
  const lat = Number(v['위도'])
  const lon = Number(v['경도'])
  if (v['위도'] === '' || !Number.isFinite(lat)) out.push(`${label}: 위도를 읽을 수 없습니다`)
  if (v['경도'] === '' || !Number.isFinite(lon)) out.push(`${label}: 경도를 읽을 수 없습니다`)
  const b = CONFIG.stationBounds
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat < b.latMin || lat > b.latMax || lon < b.lonMin || lon > b.lonMax)) {
    out.push(`${label}: 좌표가 대한민국 범위를 벗어났습니다 (${lat}, ${lon})`)
  }
  if ((v['지점명'] ?? '') === '') out.push(`${label}: 지점명이 비어 있습니다`)
  return out
}

/** 모든 칸의 앞뒤 공백을 지웁니다. */
function trimAll(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(values)) out[k.trim()] = (val ?? '').trim()
  return out
}
