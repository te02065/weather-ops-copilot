/**
 * 이 파일이 하는 일: AI가 쓴 문장의 숫자가 facts에 있는 숫자인지 검사합니다 (설계 F12).
 * 입력: 문장 글자, BriefingFacts
 * 출력: { ok, bad } — ok가 false면 bad에 허용되지 않은 숫자가 들어 있습니다
 * 주의점: 허용 숫자는 facts의 값과 반올림 변형(만 원 단위, % 소수 한 자리)입니다. 목표일의 날짜 숫자는 허용합니다.
 *         새 숫자를 만들어 낸 문장은 통과하지 못하고, 고정 문장으로 바뀝니다 (guard.ts).
 */

import type { BriefingFacts } from './facts'

// 앞이 숫자인 하이픈(날짜 구분자 2026-11)은 음수 기호가 아닙니다
const NUMBER = /(?<!\d)-?\d[\d,]*(?:\.\d+)?/g

/** 문장에서 숫자 토큰을 뽑습니다. 쉼표는 지웁니다. */
export function extractNumbers(text: string): number[] {
  const found = text.match(NUMBER) ?? []
  return found.map((t) => Number(t.replace(/,/g, ''))).filter((n) => Number.isFinite(n))
}

/** facts에서 허용되는 숫자 집합을 만듭니다. */
export function allowedNumbers(facts: BriefingFacts): Set<number> {
  const set = new Set<number>()
  const add = (x: number | null | undefined) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return
    set.add(x)
    set.add(Math.abs(x)) // 문장은 +/− 기호를 따로 쓰므로 절댓값도 허용
    set.add(round(x, 0))
    set.add(round(x, 1))
    set.add(round(x / 10000, 0)) // 만 원 단위
    set.add(round(x / 10000, 1))
  }
  add(facts.expectedSales)
  add(facts.baselineSales)
  add(facts.changeRatePct)
  add(facts.tempAvg)
  for (const f of facts.factors) add(f.effectPct)
  for (const v of Object.values(facts.sampleSizes)) add(v)
  for (const part of facts.targetDate.split('-')) add(Number(part))
  add(1) // '1일 기록'처럼 명세에 정해진 표현의 1은 허용합니다
  // 표에 들어 있는 모든 숫자(날씨, 기준, 추이 이유 등)를 허용합니다. 집계 값만 들어 있으므로 원본 행은 없습니다.
  for (const n of extractNumbers(JSON.stringify(facts))) add(n)
  return set
}

export function checkNumbers(text: string, facts: BriefingFacts): { ok: boolean; bad: number[] } {
  const allowed = allowedNumbers(facts)
  const bad = extractNumbers(text).filter((n) => !allowed.has(n))
  return { ok: bad.length === 0, bad }
}

/** 소수 자리에서 반올림 (자릿수는 호출하는 쪽에서 0 또는 1만 씁니다). */
function round(x: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(x * f) / f
}
