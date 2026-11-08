/**
 * 이 파일이 하는 일: 주 단위 블록 부트스트랩으로 평균 차이의 구간(신뢰구간)을 구합니다 (방법론 §9.3).
 * 입력: 날짜 순서대로 정렬된 차이 값 목록 d (예: 일별 |오차 M1| − |오차 기준선 A|)
 * 출력: 평균, 하한, 상한 (설정한 수준, 기본 95%)
 * 주의점: 날짜 사이의 연결을 살리려고 7일 블록을 통째로 뽑습니다. 난수는 시드(42)로 고정해서 같은 입력이면 같은 결과가 나옵니다.
 *         블록 길이, 반복 횟수, 시드, 수준은 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'

export interface BootstrapInterval {
  mean: number
  lower: number
  upper: number
}

/** 결정적 난수 (Mulberry32). 시드가 같으면 같은 순서로 나옵니다. */
export function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function blockBootstrapMean(values: number[], blockLen = CONFIG.bootstrapBlockDays): BootstrapInterval | null {
  const n = values.length
  if (n === 0) return null
  const block = Math.min(blockLen, n)
  const rand = seededRandom(CONFIG.bootstrapSeed)
  const means: number[] = []
  for (let b = 0; b < CONFIG.bootstrapRuns; b++) {
    let sum = 0
    let count = 0
    while (count < n) {
      const start = Math.floor(rand() * (n - block + 1))
      for (let k = 0; k < block && count < n; k++) {
        sum += values[start + k]!
        count++
      }
    }
    means.push(sum / n)
  }
  means.sort((a, b) => a - b)
  const tail = (1 - CONFIG.bootstrapLevel) / 2
  return {
    mean: values.reduce((s, v) => s + v, 0) / n,
    lower: means[Math.floor(tail * (means.length - 1))]!,
    upper: means[Math.ceil((1 - tail) * (means.length - 1))]!,
  }
}
