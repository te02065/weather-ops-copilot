/**
 * 이 파일이 하는 일: 주간 브리핑 문장을 만듭니다 (명세 v0.1 §5 구조, 기본 문장 방식).
 * 입력: 날짜별 세 기준(DayCriteria), 날짜별 추이(DayOutlook), 날짜별 메뉴 표(MenuRow)
 * 출력: 한 줄 요약, 날짜별 줄 목록(6단계 순서), 메뉴 요약(말로 3개), 참고할 일, 고정 문구, 한계 문장
 * 주의점: 숫자는 계산 결과에서만 가져옵니다. 금지 문장(정확, 발주, 가격, 반드시, 검증됐다, 날씨 때문에)은 쓰지 않습니다.
 *         사장님이 읽는 글이므로 어려운 말(보통, 같은 날씨, 표본 등)을 쓰지 않습니다.
 *         파일럿에서는 이 기본 문장만 씁니다 (명세 D-8). AI 문장은 별도 경로입니다.
 */

import type { DayCriteria } from './threeCriteria'
import type { DayOutlook } from './outlook'
import type { MenuRow } from './menuCriteria'
import { weatherView } from './forecastView'

export const FIXED_FOOTER = '참고용 브리핑이에요. 정확도는 아직 검증 중이에요.'
export const FORBIDDEN_WORDS = ['정확하', '발주', '가격', '반드시', '검증됐', '날씨 때문에']
export const TIP_TEXT = '참고할 수 있는 일: 비 예보가 있는 날은 과거 비 오는 날의 준비량과 비교해 볼 수 있어요.'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export interface DayInput { criteria: DayCriteria; outlook: DayOutlook | null; menu: MenuRow[] }
export interface DayText { title: string; lines: string[] }
export interface MenuSummary { movers: string[]; steady: string | null }
export interface WeeklyText { summary: string; days: DayText[]; menu: MenuSummary; tip: string; footer: string; limits: string[] }

/** 만 원 단위 문장. 1만 원 미만은 "1만 원 미만". */
export function manWonText(x: number): string {
  if (x < 10000) return '1만 원 미만'
  return `약 ${Math.round(x / 10000)}만 원`
}

function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
}

/** ③ 줄의 이름. 날씨 종류에 따라 사장님이 바로 알 수 있는 말을 씁니다. */
export function sameWeatherName(c: DayCriteria): string {
  if (c.weatherLabel === '비 없음') return '비 없는 날 평균 매출'
  if (c.weatherLabel === '약한 비') return '약한 비 온 날 평균 매출'
  if (c.weatherLabel === '강한 비') return '강한 비 온 날 평균 매출'
  if (c.probabilityOnly) return `${c.weatherLabel.replace('비 가능성 ', '비 올 확률 ')}일 때 평균 매출`
  return '날씨별 평균 매출'
}

/** 한 날짜의 줄 목록. 순서: 날씨 → ①②③ → 예상 → 메뉴 → 참고할 일. */
export function dayText({ criteria: c, outlook: o, menu }: DayInput): DayText {
  const dow = DOW[c.dow]
  const v = weatherView(c.forecast)
  const title = `${monthDay(c.date)}(${dow}) · ${v.icon} ${v.line}`
  const lines: string[] = []
  lines.push(`${dow}요일 평균 매출: ${c.sameWeekday.avg === null ? '비교할 날이 부족해요' : `${manWonText(c.sameWeekday.avg)} (${c.sameWeekday.n}일 기록)`}`)
  lines.push(`작년 ${monthDay(c.date)} 매출: ${c.lastYear.sales === null ? '작년 기록이 없어요' : `${manWonText(c.lastYear.sales)} (1일 기록)`}`)
  lines.push(`${sameWeatherName(c)}: ${sameWeatherPhrase(c)}`)
  if (o && o.direction !== 'unknown') {
    const dirText = o.direction === 'more' ? '평소보다 많이 팔릴 가능성이 있어요' : o.direction === 'less' ? '평소보다 적게 팔릴 가능성이 있어요' : '평소와 비슷할 가능성이 있어요'
    lines.push(`예상: ${dirText}. ${o.reason}`)
  } else {
    lines.push('예상: 날씨 자료가 부족해 이 날은 날씨에 따른 차이를 말하기 어려워요.')
  }
  const movers = menu.filter((m) => m.sensitivity === '높음' || m.sensitivity === '보통').sort((a, b) => Math.abs(b.diffPct ?? 0) - Math.abs(a.diffPct ?? 0)).slice(0, 3)
  if (movers.length > 0) lines.push(`날씨에 따라 많이 달라지는 메뉴: ${movers.map((m) => m.name).join(', ')}`)
  lines.push(TIP_TEXT)
  return { title, lines }
}

function sameWeatherPhrase(c: DayCriteria): string {
  if (c.weatherLabel === '예보 없음') return '예보가 없어 계산하지 않았어요'
  if (c.sameWeather.avg === null) return '아직 비교할 날이 부족해요'
  if (c.sameWeather.range) return `${manWonText(c.sameWeather.range[0])} ~ ${manWonText(c.sameWeather.range[1]).replace('약 ', '')} (${c.sameWeather.n}일 기록)`
  return `${manWonText(c.sameWeather.avg)} (${c.sameWeather.n}일 기록)`
}

/** 이번 주 한 줄 요약. 추이가 있는 날만 셉니다. */
export function summaryText(days: DayInput[]): string {
  const known = days.filter((d) => d.outlook && d.outlook.direction !== 'unknown')
  const more = known.filter((d) => d.outlook!.direction === 'more').length
  const less = known.filter((d) => d.outlook!.direction === 'less').length
  const similar = known.filter((d) => d.outlook!.direction === 'similar').length
  if (known.length === 0) return '이번 7일은 날씨 자료가 부족해 날씨에 따른 차이를 말하기 어려워요.'
  return `이번 7일 중 ${more}일은 평소보다 많이, ${less}일은 적게, ${similar}일은 비슷할 가능성이 있어요 (날씨 자료가 있는 ${known.length}일 기준).`
}

/**
 * 메뉴 요약 (명세 §3, 브리핑·PDF용): 날씨에 따라 많이 달라지는 메뉴 최대 3개, 날씨와 관계없이 비슷한 메뉴 1개.
 * 메뉴마다 날짜별 값 중 차이가 가장 큰 값을 씁니다. '기타'는 제외합니다.
 */
export function menuSummary(days: DayInput[]): MenuSummary {
  const best = new Map<string, MenuRow>()
  for (const d of days) {
    for (const m of d.menu) {
      if (m.name === '기타' || m.diffPct === null) continue
      const cur = best.get(m.name)
      if (!cur || Math.abs(m.diffPct) > Math.abs(cur.diffPct ?? 0)) best.set(m.name, m)
    }
  }
  const all = Array.from(best.values())
  const movers = all
    .filter((m) => m.sensitivity === '높음' || m.sensitivity === '보통')
    .sort((a, b) => Math.abs(b.diffPct!) - Math.abs(a.diffPct!))
    .slice(0, 3)
    .map((m) => m.name)
  const steady = all.filter((m) => m.sensitivity === '낮음').sort((a, b) => Math.abs(a.diffPct!) - Math.abs(b.diffPct!))[0]
  return { movers, steady: steady ? steady.name : null }
}

/** 주간 브리핑 전체. 한계 문장은 한계 박스에 넣습니다. */
export function weeklyText(days: DayInput[]): WeeklyText {
  return {
    summary: summaryText(days),
    days: days.map(dayText),
    menu: menuSummary(days),
    tip: TIP_TEXT,
    footer: FIXED_FOOTER,
    limits: [
      '비교한 날 수가 적으면 숫자는 참고만 하세요.',
      '원인을 단정하지 않아요. 과거에 함께 나타난 차이예요.',
      '요일, 행사, 판매 조건이 바뀐 것은 아직 반영하지 않았어요.',
      '날씨 예보는 틀릴 수 있어요.',
    ],
  }
}

/** 금지 문장이 들어갔는지 확인합니다. 들어갔으면 그 단어 목록을 돌려줍니다. */
export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_WORDS.filter((w) => text.includes(w))
}

/** 이번 7일 추이 개수 (추이가 있는 날만). 브리핑 AI 입력용. */
export function weekCounts(outlook: Array<DayOutlook | null>): { more: number; less: number; similar: number; known: number } {
  const known = outlook.filter((o): o is DayOutlook => o !== null && o.direction !== 'unknown')
  return {
    more: known.filter((o) => o.direction === 'more').length,
    less: known.filter((o) => o.direction === 'less').length,
    similar: known.filter((o) => o.direction === 'similar').length,
    known: known.length,
  }
}
