/**
 * 이 파일이 하는 일: 체감온도(바람 냉각 식)를 계산합니다. 보조 특징이며 기본 모델(M1)에는 넣지 않습니다.
 * 입력: 평균 기온(℃), 평균 풍속(m/s)
 * 출력: 체감온도(℃) 또는 적용 조건이 아니면 undefined
 * 주의점: 적용 조건은 기온 10℃ 이하, 풍속 1.3m/s 이상입니다 (설계 §9). 조건 밖이면 결측으로 둡니다.
 *         공식 상수는 analysis/config.ts의 comfortFormula에 있습니다.
 *         포털 예시값과의 대조 테스트는 [예시값 확보 필요]입니다. 지금은 공식 자체만 확인합니다.
 */

import { CONFIG } from './config'

export function comfortTempC(tempC: number | null, windMs: number | null): number | undefined {
  if (tempC === null || windMs === null) return undefined
  if (tempC > CONFIG.comfortMaxTempC || windMs < CONFIG.comfortMinWindMs) return undefined
  const f = CONFIG.comfortFormula
  const vKmh = windMs * f.kmhPerMs
  const v16 = Math.pow(vKmh, f.exp)
  return f.a + f.b * tempC - f.c * v16 + f.d * tempC * v16
}
