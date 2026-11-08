/**
 * 이 파일이 하는 일: 예측 결과의 상태 코드와 고정 문구를 정합니다 (방법론 §10).
 * 입력: 학습 표본 상태 (학습 일수, 강수 일수, 구간별 표본, 날씨 결측 비율, 예보 강수 유무, 캐시 stale 여부)
 * 출력: 상태 코드 하나와 고정 문구
 * 주의점: 문구는 방법론 §10 표를 그대로 씁니다. 순서(우선순위)는 아래 코드 순서입니다.
 *         기준 숫자(56, 20, 8, 5%)는 analysis/config.ts에서 가져옵니다.
 */

import { CONFIG } from './config'

export type StatusCode =
  | 'ok'
  | 'insufficient_data'
  | 'insufficient_band'
  | 'missing_weather'
  | 'missing_sales'
  | 'forecast_unavailable'
  | 'stale_weather'

/** 방법론 §10의 고정 문구. 이 문구를 바꾸면 방법론 버전을 올립니다. */
export const STATUS_TEXT: Record<StatusCode, string> = {
  ok: '',
  insufficient_data: '데이터가 부족해 예측을 만들지 않았습니다.',
  insufficient_band: '해당 날씨 조건의 과거 데이터가 적어 그 효과는 계산하지 않았습니다.',
  missing_weather: '날씨 데이터가 부족한 기간이 있어 해당 기간은 제외했습니다.',
  missing_sales: '매출 데이터가 없는 날은 예측 대상이 아닙니다.',
  forecast_unavailable: '이 날짜는 날씨 예보 없이 기준선으로만 계산했습니다.',
  stale_weather: '날씨 데이터 갱신이 지연되어 이전 자료를 사용했습니다.',
}

export interface StatusInput {
  trainDays: number          // 학습에 쓴 유효 영업일 수
  rainDays: number           // 학습에 쓴 강수(none 아님) 영업일 수 (G3 미달은 상태 코드가 아니라 '미확정' 표시로 다룹니다 [고정 문구 없음, 확인 필요])
  bandDays: { light: number; heavy: number } // 강수 구간별 학습 표본
  weatherMissingRatio: number // 최근 기간에서 날씨가 빠진 비율 (0~1)
  forecastPrecipKnown: boolean // 목표일 강수 예보(또는 관측)가 있는지
  staleWeather: boolean      // 캐시의 예전 값을 썼는지
  targetRainBand: 'none' | 'light' | 'heavy' | null
  targetSalesMissing?: boolean
}

/** 우선순위: 데이터 부족 → 날씨 결측 → 목표일 매출 없음 → 예보 없음 → stale → 구간 부족 → ok. */
export function evaluateStatus(s: StatusInput): { code: StatusCode; text: string } {
  const code = pickStatus(s)
  return { code, text: STATUS_TEXT[code] }
}

function pickStatus(s: StatusInput): StatusCode {
  if (s.trainDays < CONFIG.minTrainDays) return 'insufficient_data'
  if (s.weatherMissingRatio > CONFIG.maxWeatherMissingRatio) return 'missing_weather'
  if (s.targetSalesMissing) return 'missing_sales'
  if (!s.forecastPrecipKnown) return 'forecast_unavailable'
  if (s.staleWeather) return 'stale_weather'
  if (s.targetRainBand === 'light' && s.bandDays.light < CONFIG.minBandDays) return 'insufficient_band'
  if (s.targetRainBand === 'heavy' && s.bandDays.heavy < CONFIG.minBandDays) return 'insufficient_band'
  return 'ok'
}
