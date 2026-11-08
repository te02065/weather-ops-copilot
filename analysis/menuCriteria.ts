/**
 * 이 파일이 하는 일: 메뉴별로 ①같은 요일 ③같은 날씨 평균을 구하고, 날씨에 따라 얼마나 달라지는지 등급(민감도)을 정합니다 (명세 §3).
 * 입력: 메뉴별 일 매출(MenuDaily), 특징 행, 기준일, 날짜, 예보 날씨(없으면 null)
 * 출력: 메뉴마다 ①, ③, 전체 평균 대비 차이(%), 민감도 등급(높음·보통·낮음·미확정), 비교 날 수
 * 주의점: 상위 N개 메뉴만 따로 보여 주고 나머지는 '기타'로 묶습니다. 비교할 날이 부족하면 등급을 '미확정'으로 둡니다.
 *         메뉴 기록이 없으면 호출하지 않습니다 (웹에 '메뉴별 기록이 없어요' 안내).
 */

import { CONFIG } from './config'
import { isValidDay } from './features'
import type { MenuDaily } from './posReport'
import type { FeatureRow } from './types'

export type Sensitivity = '높음' | '보통' | '낮음' | '미확정'
export interface MenuRow {
  name: string
  sameWeekday: number | null   // ①
  sameWeather: number | null   // ③ (비 가능성 두 구간이면 평균)
  diffPct: number | null       // 전체 평균 대비 ③의 차이 (%)
  sensitivity: Sensitivity
  days: number                 // 비교한 날 수
}

/** 날짜별 메뉴 합계 (없는 날은 0). */
function dailyByMenu(menu: MenuDaily[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const m of menu) {
    const byDate = out.get(m.menuKey) ?? new Map<string, number>()
    byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.amount)
    out.set(m.menuKey, byDate)
  }
  return out
}

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length
}

export function menuCriteria(
  menu: MenuDaily[],
  features: FeatureRow[],
  cutoff: string,
  date: string,
  bands: Array<'none' | 'light' | 'heavy'> | null,   // 예보 구간 (두 개면 비 가능성 범위)
): MenuRow[] {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const valid = features.filter((r) => r.date <= cutoff && isValidDay(r))
  const totals = new Map<string, number>()
  for (const m of menu) totals.set(m.menuKey, (totals.get(m.menuKey) ?? 0) + m.amount)
  const names = new Map<string, string>()
  for (const m of menu) if (!names.has(m.menuKey)) names.set(m.menuKey, m.menu)
  const top = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, CONFIG.menuTopN).map(([k]) => k)
  const byMenu = dailyByMenu(menu)
  const rowFor = (label: string, series: Map<string, number>): MenuRow => {
    const days = valid.map((r) => ({ r, v: series.get(r.date) ?? 0 }))
    const all = mean(days.map((x) => x.v))
    const wd = days.filter((x) => x.r.dow === dow)
    const sameWeekday = wd.length >= CONFIG.menuMinDays ? mean(wd.map((x) => x.v)) : null
    const wb = (bands ?? []).map((b) => mean(days.filter((x) => x.r.rainBand === b).map((x) => x.v)))
    const wbDays = (bands ?? []).map((b) => days.filter((x) => x.r.rainBand === b).length)
    const usable = wb.filter((x): x is number => x !== null)
    const sameWeather = usable.length ? mean(usable) : null
    const minDays = wbDays.length ? Math.min(...wbDays) : 0
    const diffPct = sameWeather !== null && all ? ((sameWeather - all) / all) * 100 : null
    let sensitivity: Sensitivity = '미확정'
    if (diffPct !== null && minDays >= CONFIG.menuMinDays) {
      const a = Math.abs(diffPct)
      sensitivity = a >= CONFIG.menuSensitiveHighPct ? '높음' : a >= CONFIG.menuSensitiveMidPct ? '보통' : '낮음'
    }
    return { name: label, sameWeekday, sameWeather, diffPct, sensitivity, days: minDays }
  }
  const rows = top.map((k) => rowFor(names.get(k) ?? k, byMenu.get(k) ?? new Map()))
  // 나머지는 '기타'로 묶어 같은 방식으로 계산
  const rest = new Map<string, number>()
  for (const [k, byDate] of Array.from(byMenu.entries())) {
    if (top.includes(k)) continue
    for (const [d, v] of Array.from(byDate.entries())) rest.set(d, (rest.get(d) ?? 0) + v)
  }
  if (rest.size > 0) rows.push(rowFor('기타', rest))
  return rows
}
