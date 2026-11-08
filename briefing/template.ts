/**
 * 이 파일이 하는 일: AI 문장을 쓸 수 없을 때 쓰는 고정 문장을 facts 값으로 만듭니다.
 * 입력: BriefingFacts
 * 출력: 여러 줄의 한국어 문장 (숫자는 모두 facts에서 가져옵니다)
 * 주의점: 이 문장은 AI가 만든 것이 아니라 계산 결과를 그대로 적은 것입니다. 데모 문장이 아닙니다.
 *         상태가 ok가 아니면 방법론 §10의 고정 문구를 씁니다. 날씨, 세 기준, 추이, 메뉴 줄은 facts에 있을 때 모두 적습니다.
 */

import { STATUS_TEXT, type StatusCode } from '../analysis/status'
import { dateLabelKo, type BriefingCriteria, type BriefingFacts, type BriefingWeather } from './facts'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function templateBriefing(f: BriefingFacts): string {
  const lines: string[] = [`${f.targetLabel ?? dateLabelKo(f.targetDate)} 예측`]
  if (f.status !== 'ok') {
    lines.push(STATUS_TEXT[f.status as StatusCode] ?? '예측 상태를 확인하세요.')
  }
  if (f.weather) lines.push(weatherSentence(f.weather))
  if (f.criteria) lines.push(...criteriaLines(f.criteria, f.targetDate))
  if (f.changeRatePct !== null && f.baselineSales !== null) {
    const dir = f.changeRatePct >= 0 ? '많이' : '적게'
    lines.push(`같은 요일 평균 매출(${manWon(f.baselineSales)})보다 약 ${Math.abs(f.changeRatePct)}% ${dir} 팔릴 가능성이 있습니다.`)
  } else if (f.baselineSales !== null) {
    lines.push(`같은 요일 평균 매출은 ${manWon(f.baselineSales)}입니다.`)
  }
  if (f.outlookDirection && f.outlookDirection !== 'unknown') {
    lines.push(directionSentence(f.outlookDirection, f.outlookReason ?? null))
  }
  if (f.menuMovers && f.menuMovers.length > 0) lines.push(`날씨에 따라 많이 달라지는 메뉴: ${f.menuMovers.join(', ')}`)
  for (const fx of f.factors) {
    lines.push(factorSentence(fx.label, fx.effectPct))
  }
  for (const r of f.recommendations) lines.push(`참고: ${r}`)
  return lines.join('\n')
}

/** 날씨 예보 한 문장. 비는 강수량이 있으면 그 값, 없으면 강수확률로 말합니다. */
function weatherSentence(w: BriefingWeather): string {
  const parts: string[] = []
  if (w.sky) parts.push(w.sky)
  if (w.tempMin !== null && w.tempMax !== null) parts.push(`최저 ${w.tempMin}℃, 최고 ${w.tempMax}℃`)
  if (w.precipMm !== null && w.precipMm >= 0.1) parts.push(`비 예보 ${w.precipMm}mm`)
  else if (w.popPct !== null) parts.push(w.popPct >= 30 ? `비 올 확률 ${w.popPct}%` : '비 소식 없음')
  return `날씨 예보: ${parts.length > 0 ? parts.join(', ') : '자료가 부족해요'}.`
}

/** ①②③ 세 기준을 쉬운 줄로. 값이 없으면 "비교할 날이 부족해요"입니다. */
function criteriaLines(c: BriefingCriteria, date: string): string[] {
  const dow = DOW[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const out: string[] = []
  out.push(c.sameWeekdayAvg === null
    ? `${dow}요일 평균 매출: 비교할 날이 부족해요.`
    : `${dow}요일 평균 매출은 ${manWon(c.sameWeekdayAvg)}입니다 (${c.sameWeekdayN}일 기록).`)
  out.push(c.lastYearSales === null
    ? '작년 같은 날 기록이 없어요.'
    : `작년 같은 날 매출은 ${manWon(c.lastYearSales)}입니다 (1일 기록, 참고만 하세요).`)
  if (c.sameWeatherAvg === null) {
    out.push(`${c.sameWeatherName}: 비교할 날이 부족해요.`)
  } else if (c.sameWeatherRange) {
    out.push(`${c.sameWeatherName}은 ${manWon(c.sameWeatherRange[0])} ~ ${manWon(c.sameWeatherRange[1]).replace('약 ', '')}입니다 (${c.sameWeatherN}일 기록).`)
  } else {
    out.push(`${c.sameWeatherName}은 ${manWon(c.sameWeatherAvg)}입니다 (${c.sameWeatherN}일 기록).`)
  }
  return out
}

function directionSentence(direction: 'more' | 'less' | 'similar', reason: string | null): string {
  const text = direction === 'more' ? '평소보다 많이 팔릴 가능성이 있어요.' : direction === 'less' ? '평소보다 적게 팔릴 가능성이 있어요.' : '평소와 비슷할 가능성이 있어요.'
  return reason ? `${text} ${reason}` : text
}

/** 금액은 만 원 단위로 반올림해서 씁니다 (명세 §5). 1만 원 미만은 "1만 원 미만". */
function manWon(x: number): string {
  if (x < 10000) return '1만 원 미만'
  return `약 ${Math.round(x / 10000)}만 원`
}

/** 한 요인을 쉬운 한 문장으로. 기온은 "1℃ 높을수록"으로 말합니다. */
function factorSentence(label: string, effectPct: number): string {
  const dir = effectPct < 0 ? '적게' : '많이'
  const size = Math.abs(effectPct)
  if (label.startsWith('기온')) {
    return `기온이 1℃ 높을수록 매출이 약 ${size}% ${effectPct < 0 ? '줄어드는' : '늘어나는'} 경향이 있습니다.`
  }
  return `${label}은 평소보다 약 ${size}% ${dir} 팔린 경향이 있습니다.`
}
