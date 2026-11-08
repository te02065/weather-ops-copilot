/**
 * 이 파일이 하는 일: analysis/weeklyBriefing.ts 테스트 (주간 브리핑 문장 구조, 금지 문장, 고정 문구).
 * 입력: 작은 세 기준, 추이, 메뉴 표 예시
 * 출력: 테스트 통과/실패
 * 주의점: 기본 문장에는 금지 문장이 없어야 하고, 날짜마다 6단계 순서를 지켜야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { dayText, forbiddenIn, weeklyText, manWonText, menuSummary, sameWeatherName, FIXED_FOOTER, type DayInput } from '../../analysis/weeklyBriefing'
import type { DayCriteria } from '../../analysis/threeCriteria'
import type { DayOutlook } from '../../analysis/outlook'
import type { MenuRow } from '../../analysis/menuCriteria'

const criteria: DayCriteria = {
  date: '2026-11-09', dow: 1, weatherLabel: '비 없음',
  sameWeekday: { avg: 670000, n: 47 }, lastYear: { sales: 1340000, note: 'single' },
  sameWeather: { avg: 890000, n: 271 }, probabilityOnly: false, festival: 'none',
  forecast: { date: '2026-11-09', precipMm: 0, tempAvg: 10, tempMax: 14, tempMin: 6, windMs: null, sky: 'clear' },
}
const outlook: DayOutlook = { date: '2026-11-09', dow: 1, direction: 'less', rangeLow: 630000, rangeHigh: 770000, reason: '같은 달 평균(15℃)보다 8℃ 추워서 매출이 약 7% 적었던 경향' }
const menu: MenuRow[] = [
  { name: '아메리카노', sameWeekday: null, sameWeather: null, diffPct: 12, sensitivity: '높음', days: 40 },
  { name: '말차라떼', sameWeekday: null, sameWeather: null, diffPct: -6, sensitivity: '보통', days: 40 },
  { name: '잠봉뵈르', sameWeekday: null, sameWeather: null, diffPct: 1, sensitivity: '낮음', days: 40 },
]
const input: DayInput = { criteria, outlook, menu }

test('날짜 한 줄은 6단계 순서를 지킨다 (날씨 → 세 기준 → 예상 → 메뉴 → 참고할 일)', () => {
  const d = dayText(input)
  assert.equal(d.title, '11월 9일(월) · ☀️ 비 없음 · 맑음 · 최저 6℃ · 최고 14℃')
  assert.match(d.lines[0]!, /^월요일 평균 매출: 약 67만 원 \(47일 기록\)/)
  assert.match(d.lines[1]!, /^작년 11월 9일 매출: 약 134만 원/)
  assert.match(d.lines[2]!, /^비 없는 날 평균 매출: 약 89만 원 \(271일 기록\)/)
  assert.match(d.lines[3]!, /^예상: 평소보다 적게 팔릴 가능성이 있어요/)
  assert.match(d.lines[4]!, /날씨에 따라 많이 달라지는 메뉴: 아메리카노, 말차라떼/)
  assert.match(d.lines[5]!, /^참고할 수 있는 일/)
})

test('③ 줄 이름은 날씨 종류에 따라 바뀐다 (확률은 "비 올 확률"로 쓴다)', () => {
  assert.equal(sameWeatherName({ ...criteria, weatherLabel: '강한 비' }), '강한 비 온 날 평균 매출')
  assert.equal(sameWeatherName({ ...criteria, weatherLabel: '비 가능성 60%', probabilityOnly: true }), '비 올 확률 60%일 때 평균 매출')
})

test('메뉴 요약: 많이 달라지는 메뉴 최대 3개, 비슷한 메뉴 1개, 기타는 뺀다', () => {
  const days: DayInput[] = [
    { criteria, outlook, menu: [
      ...menu,
      { name: '기타', sameWeekday: null, sameWeather: null, diffPct: 30, sensitivity: '높음', days: 40 },
      { name: '디저트', sameWeekday: null, sameWeather: null, diffPct: 0.5, sensitivity: '낮음', days: 40 },
    ] },
  ]
  const s = menuSummary(days)
  assert.deepEqual(s.movers, ['아메리카노', '말차라떼'])
  assert.equal(s.steady, '디저트')
})

test('추이가 없으면 날씨 차이를 말하지 않는다', () => {
  const d = dayText({ ...input, outlook: null, menu: [] })
  assert.match(d.lines[3]!, /날씨 자료가 부족/)
  assert.ok(!d.lines.some((l) => l.includes('많이 달라지는')))
})

test('주간 브리핑은 고정 문구와 한계 문장을 포함하고, 금지 문장이 없다', () => {
  const w = weeklyText([input])
  assert.equal(w.footer, FIXED_FOOTER)
  assert.equal(w.limits.length, 4)
  const all = [w.summary, ...w.days.flatMap((d) => [d.title, ...d.lines]), w.footer, ...w.limits].join('\n')
  assert.deepEqual(forbiddenIn(all), [])
})

test('만 원 단위 표현', () => {
  assert.equal(manWonText(670000), '약 67만 원')
  assert.equal(manWonText(5000), '1만 원 미만')
})

test('금지 문장 검사는 금지 단어를 찾는다', () => {
  assert.deepEqual(forbiddenIn('정확하게 맞춘다'), ['정확하'])
  assert.deepEqual(forbiddenIn('날씨 때문에 줄었다'), ['날씨 때문에'])
})
