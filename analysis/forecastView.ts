/**
 * 이 파일이 하는 일: 하루 예보(DailyWeather)를 사장님이 바로 읽는 날씨 줄과 아이콘으로 바꿉니다.
 * 입력: DailyWeather (없으면 null)
 * 출력: 아이콘, 강수 한 줄, 하늘 한 줄, 기온 한 줄, 한 줄 요약
 * 주의점: 아이콘 기준은 강수량 0.1mm 이상(비 예보), 강수확률 60% 이상(비 올 확률 높음), 30~59%(비 올 수도)입니다.
 *         이 기준은 화면 설명용 운영 기준입니다. 분석 계산(비 없음/약한 비/강한 비)은 threeCriteria가 따로 씁니다.
 *         숫자는 예보 값에서만 가져옵니다.
 */

import type { DailyWeather, SkyCode } from './types'

export type RainLevel = 'rain' | 'likely' | 'maybe' | 'none' | 'unknown'
export interface WeatherView { icon: string; level: RainLevel; rain: string; sky: string; temp: string; line: string }

const SKY_ICON: Record<SkyCode, string> = { clear: '☀️', cloudy: '⛅', overcast: '☁️' }
const SKY_TEXT: Record<SkyCode, string> = { clear: '맑음', cloudy: '구름많음', overcast: '흐림' }

/** 강수 수준. 강수량이 있으면 강수량을 먼저 보고, 없으면 강수확률을 봅니다. */
export function rainLevelOf(w: DailyWeather): { level: RainLevel; prob: number | null } {
  const prob = w.popPct ?? w.rainProbPct ?? null
  if (w.precipMm !== null && w.precipMm !== undefined && w.precipMm >= 0.1) return { level: 'rain', prob }
  if (prob === null) return { level: w.precipMm !== null && w.precipMm !== undefined ? 'none' : 'unknown', prob: null }
  if (prob >= 60) return { level: 'likely', prob }
  if (prob >= 30) return { level: 'maybe', prob }
  return { level: 'none', prob }
}

export function weatherView(w: DailyWeather | null | undefined): WeatherView {
  if (!w) return { icon: '❔', level: 'unknown', rain: '예보 없음', sky: '', temp: '', line: '예보 없음' }
  const { level, prob } = rainLevelOf(w)
  const skyIcon = w.sky ? SKY_ICON[w.sky] : '🌤️'
  const icon = level === 'rain' || level === 'likely' ? '☂️' : level === 'maybe' ? '🌦️' : skyIcon
  const rain = level === 'rain'
    ? `비 예보 ${w.precipMm!.toFixed(1)}mm`
    : level === 'likely' || level === 'maybe' ? `비 올 확률 ${prob}%`
    : level === 'none' ? '비 없음' : '강수 정보 없음'
  const sky = w.sky ? SKY_TEXT[w.sky] : ''
  const temp = w.tempMin !== null && w.tempMin !== undefined && w.tempMax !== null && w.tempMax !== undefined
    ? `최저 ${Math.round(w.tempMin)}℃ · 최고 ${Math.round(w.tempMax)}℃`
    : w.tempAvg !== null && w.tempAvg !== undefined ? `평균 ${Math.round(w.tempAvg)}℃` : ''
  const line = [rain, sky, temp].filter((x) => x !== '').join(' · ')
  return { icon, level, rain, sky, temp, line }
}
