/**
 * 이 파일이 하는 일: 시간별 예보 값(기온, 1시간 강수량, 강수확률, 하늘상태)을 하루 값으로 묶습니다.
 * 입력: 목표일, 0~23시 기온 목록, 0~23시 1시간 강수량 목록, 샘플 시각의 강수확률·하늘상태 코드 (없으면 빈 목록)
 * 출력: DailyWeather (precipMm, tempAvg, tempMax, tempMin, popPct, sky, windMs=null)
 * 주의점: 하루 강수량은 시간별 강수량의 합입니다. 모든 시간이 비어 있으면 null입니다 (0으로 보지 않습니다).
 *         기온은 있는 시간만으로 평균, 최고, 최저를 구합니다.
 *         강수확률은 샘플 시각 중 최댓값, 하늘상태는 샘플 중 가장 많이 나온 값입니다 (같으면 더 흐린 쪽).
 *         예보는 예보값이므로 관측값과 같지 않습니다. 화면에 "예보 기준"이라고 표시합니다.
 */

import type { DailyWeather, SkyCode } from '../analysis/types'

export interface SampleExtra { pops: Array<number | null>; skys: Array<number | null> }

export function aggregateDay(date: string, temps: Array<number | null>, precips: Array<number | null>, extra: SampleExtra = { pops: [], skys: [] }): DailyWeather {
  const t = temps.filter((x): x is number => x !== null)
  const p = precips.filter((x): x is number => x !== null)
  const pops = extra.pops.filter((x): x is number => x !== null)
  return {
    date,
    precipMm: p.length === 0 ? null : round1(p.reduce((s, x) => s + x, 0)),
    tempAvg: t.length === 0 ? null : round1(t.reduce((s, x) => s + x, 0) / t.length),
    tempMax: t.length === 0 ? null : Math.max(...t),
    tempMin: t.length === 0 ? null : Math.min(...t),
    windMs: null,
    popPct: pops.length === 0 ? null : Math.max(...pops),
    sky: skyOfSamples(extra.skys),
  }
}

/** 기상청 SKY 코드 (1 맑음, 3 구름많음, 4 흐림)를 하늘상태로 바꿉니다. 모르는 코드는 null. */
export function skyFromKma(code: number | null): SkyCode | null {
  if (code === 1) return 'clear'
  if (code === 3) return 'cloudy'
  if (code === 4) return 'overcast'
  return null
}

/** 중기예보 글자(맑음, 구름많음, 흐림, 비 …)를 하늘상태로 바꿉니다. 비나 눈이 있으면 흐림으로 봅니다. */
export function skyFromText(text: string | null | undefined): SkyCode | null {
  if (!text) return null
  if (text.includes('비') || text.includes('눈') || text.includes('흐림')) return 'overcast'
  if (text.includes('구름많음') || text.includes('구름많')) return 'cloudy'
  if (text.includes('맑음')) return 'clear'
  return null
}

/** 샘플 시각의 하늘상태 가운데 가장 많이 나온 값. 같으면 더 흐린 쪽. */
function skyOfSamples(codes: Array<number | null>): SkyCode | null {
  const count = new Map<number, number>()
  for (const c of codes) if (c !== null) count.set(c, (count.get(c) ?? 0) + 1)
  if (count.size === 0) return null
  const best = Array.from(count.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
  return skyFromKma(best)
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
