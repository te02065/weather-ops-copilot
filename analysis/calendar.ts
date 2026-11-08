/**
 * 이 파일이 하는 일: 날짜별 달력 표시(공휴일, 휴무, 행사, 프로모션)를 읽습니다.
 * 입력: 달력 입력 목록 (사용자가 직접 입력한 날짜와 종류)
 * 출력: 날짜별 표시 (isHoliday, isClosed, isPromo, hasEvent)
 * 주의점: 공휴일 목록은 이 파일이 만들지 않습니다. 출처가 아직 정해지지 않았습니다 [확인 필요, 설계 §12].
 *         사용자가 입력한 공휴일만 씁니다. 공휴일이 아닌 날을 공휴일로 잘못 세지 않도록 주의하세요.
 */

import type { CalendarEvent } from './types'

export interface DayCalendar {
  isHoliday: boolean
  isClosed: boolean
  isPromo: boolean
  hasEvent: boolean
}

/** 날짜 하나의 달력 표시를 구합니다. 입력에 없는 날은 모두 false입니다. */
export function dayCalendar(date: string, events: CalendarEvent[]): DayCalendar {
  const mine = events.filter((e) => e.date === date)
  return {
    isHoliday: mine.some((e) => e.type === 'holiday'),
    isClosed: mine.some((e) => e.type === 'closed'),
    isPromo: mine.some((e) => e.type === 'promotion'),
    hasEvent: mine.some((e) => e.type === 'event'),
  }
}
