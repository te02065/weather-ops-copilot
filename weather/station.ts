/**
 * 이 파일이 하는 일: 매장 좌표에서 가장 가까운 관측소를 고르고, 거리를 계산합니다.
 * 입력: 매장 위경도, 관측소 목록 (StationList). 목록은 data/weather_cache/stations.json에서 읽습니다.
 * 출력: 가장 가까운 관측소와 거리, 또는 "확인 필요" 상태
 * 주의점: 관측소 번호를 코드에 직접 쓰지 않습니다. 목록은 지점정보 조회로 만든 파일이고,
 *         파일의 confirmed가 true일 때만 씁니다. 확정 전에는 관측소를 고르지 않고 "[확인 필요]"를 돌려줍니다.
 *         거리가 기준(관측소 30km, 방법론 §3)보다 멀면 warning을 true로 돌려줍니다.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { CONFIG } from '../analysis/config'
import { haversineKm } from './geo'
import type { StationList, StationRecord } from './types'

export const STATION_LIST_FILE = join('data', 'weather_cache', 'stations.json')

export type NearestResult =
  | { status: 'unconfirmed'; note: '[확인 필요]' }
  | { status: 'ok'; station: StationRecord; distanceKm: number; warning: boolean }

/** 관측소 목록 파일을 읽습니다. 파일이 없으면 확정되지 않은 빈 목록입니다. */
export function loadStationList(path: string = STATION_LIST_FILE): StationList {
  if (!existsSync(path)) return { confirmed: false, stations: [] }
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as StationList
  return { confirmed: parsed.confirmed === true, stations: parsed.stations ?? [] }
}

/** 확정된 목록에서 가장 가까운 관측소를 고릅니다. */
export function nearestStation(
  store: { lat: number; lon: number },
  list: StationList,
): NearestResult {
  if (!list.confirmed || list.stations.length === 0) return { status: 'unconfirmed', note: '[확인 필요]' }
  let best: { station: StationRecord; distanceKm: number } | null = null
  for (const station of list.stations) {
    const distanceKm = haversineKm(store, station, CONFIG.kmaGrid.earthRadiusKm)
    if (best === null || distanceKm < best.distanceKm) best = { station, distanceKm }
  }
  const { station, distanceKm } = best!
  return {
    status: 'ok',
    station,
    distanceKm,
    warning: distanceKm > CONFIG.stationMaxDistanceKm,
  }
}
