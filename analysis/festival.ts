/**
 * 이 파일이 하는 일: 설·추석 같은 명절 전후 날짜를 찾습니다 (명세 v0.1 §2 명절 처리).
 * 입력: 공휴일 목록 (날짜, 이름)
 * 출력: 명절 당일 집합, 명절 전후 3일(제외 대상) 집합
 * 주의점: 명절 이름은 '설날', '추석'을 포함하는 것으로 봅니다 (특일 API 이름 기준). 대체공휴일도 포함됩니다.
 *         전후 날 수는 config.festivalWindowDays에서 가져옵니다 (명세 D-6: 3일).
 */

import { CONFIG } from './config'
import { addDaysIso } from './dates'

export interface FestivalSets { days: Set<string>; window: Set<string> }

export function festivalSets(holidays: Array<{ date: string; name: string }>): FestivalSets {
  const days = new Set<string>()
  const window = new Set<string>()
  for (const h of holidays) {
    if (!/설날|추석/.test(h.name)) continue
    days.add(h.date)
    for (let k = -CONFIG.festivalWindowDays; k <= CONFIG.festivalWindowDays; k++) window.add(addDaysIso(h.date, k))
  }
  return { days, window }
}
