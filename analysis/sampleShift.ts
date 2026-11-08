/**
 * 이 파일이 하는 일: 합성 샘플의 날짜를 오늘 기준으로 옮깁니다. 요일이 그대로 유지되도록 7의 배수만큼만 옮깁니다.
 * 입력: CSV 글자 (첫 열이 YYYY-MM-DD 날짜), 옮길 날 수, 기준 날짜
 * 출력: 날짜가 옮겨진 CSV 글자, 옮길 날 수
 * 주의점: 샘플은 가짜 데이터입니다. 과거 날짜가 예측 대상으로 뜨는 문제를 피하려고만 씁니다.
 *         날씨 샘플과 매출 샘플에 같은 날 수를 적용해야 날짜가 서로 맞습니다.
 */

import { addDaysIso, daysBetween } from './dates'

/** 마지막 데이터 날짜(lastIso)를 목표 날짜(targetIso) 근처로 옮기는 날 수. 7의 배수입니다. */
export function weekShiftDays(lastIso: string, targetIso: string): number {
  return Math.round(daysBetween(lastIso, targetIso) / 7) * 7
}

/** CSV 첫 열의 마지막 날짜. 데이터 행이 없으면 null. */
export function lastDateOf(text: string): string | null {
  const rows = text.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  const last = rows[rows.length - 1]
  if (!last || rows.length < 2) return null
  return last.split(',')[0] ?? null
}

/** 헤더를 뺀 모든 행의 첫 열 날짜를 days만큼 옮깁니다. 다른 열과 줄바꿈은 그대로 둡니다. */
export function shiftCsvDates(text: string, days: number): string {
  return text
    .split('\n')
    .map((line, i) => {
      if (i === 0 || line.trim() === '') return line
      const comma = line.indexOf(',')
      if (comma < 0) return line
      return addDaysIso(line.slice(0, comma), days) + line.slice(comma)
    })
    .join('\n')
}
