/**
 * 이 파일이 하는 일: 위경도를 기상청 단기예보 격자(nx, ny)로 바꾸고, 격자를 위경도로 되돌립니다.
 * 입력: 위도·경도 (도 단위) 또는 격자 번호 nx, ny
 * 출력: { nx, ny } 또는 { lat, lon }
 * 주의점: 공식 상수는 analysis/config.ts의 kmaGrid에 있습니다 (바꾸지 않는 고정 값).
 *         격자 번호는 정수입니다. 매장과 격자 중심이 정확히 같지 않으므로, 거리(distanceKm)를 함께 저장해야 합니다.
 *         검산: 서울시청(37.5665, 126.9780)은 격자 (60, 127)이어야 합니다 (테스트에서 확인).
 */

import { CONFIG } from '../analysis/config'

const K = CONFIG.kmaGrid
const DEG = Math.PI / 180
const RE = K.earthRadiusKm / K.gridKm
const SLAT1 = K.slat1 * DEG
const SLAT2 = K.slat2 * DEG
const OLON = K.olon * DEG
const OLAT = K.olat * DEG

// 투영 상수 (기상청 공식 Lambert 정각원추 투영 공식)
const SN =
  Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) /
  Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5))
const SF = (Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), SN) * Math.cos(SLAT1)) / SN
const RO = (RE * SF) / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), SN)

/** 위경도 → 격자 번호 (정수). */
export function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const ra = (RE * SF) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5), SN)
  let theta = lon * DEG - OLON
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= SN
  const x = ra * Math.sin(theta) + K.xo + 0.5
  const y = RO - ra * Math.cos(theta) + K.yo + 0.5
  return { nx: Math.floor(x), ny: Math.floor(y) }
}

/** 격자 번호 → 위경도 (격자 기준점). toGrid와 짝을 이룹니다. */
export function fromGrid(nx: number, ny: number): { lat: number; lon: number } {
  const xn = nx - K.xo
  const yn = RO - ny + K.yo
  let ra = Math.sqrt(xn * xn + yn * yn)
  if (SN < 0) ra = -ra
  const alat = 2 * Math.atan(Math.pow((RE * SF) / ra, 1 / SN)) - Math.PI * 0.5
  let theta = 0
  if (Math.abs(xn) > 0) {
    theta = Math.abs(yn) > 0 ? Math.atan2(xn, yn) : (Math.PI * 0.5) * Math.sign(xn)
  }
  const alon = theta / SN + OLON
  return { lat: alat / DEG, lon: alon / DEG }
}
