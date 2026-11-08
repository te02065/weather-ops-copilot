/**
 * 이 파일이 하는 일: weather/grid.ts와 weather/geo.ts 테스트 (격자 변환, 거리).
 * 입력: 알려진 도시 좌표 (서울시청, 부산시청)와 격자 번호
 * 출력: 테스트 통과/실패
 * 주의점: 서울시청 격자 (60, 127)과 부산시청 격자 (98, 76)은 기상청 격자표의 알려진 값입니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG } from '../../analysis/config'
import { toGrid, fromGrid } from '../../weather/grid'
import { haversineKm } from '../../weather/geo'

test('서울시청 좌표는 격자 (60, 127)이다', () => {
  assert.deepEqual(toGrid(37.5665, 126.978), { nx: 60, ny: 127 })
})

test('부산시청 좌표는 격자 (98, 76)이다', () => {
  assert.deepEqual(toGrid(35.1796, 129.0756), { nx: 98, ny: 76 })
})

test('격자 → 위경도 → 격자로 되돌리면 같은 격자가 나온다', () => {
  for (const [nx, ny] of [[60, 127], [55, 124], [90, 130], [73, 134], [43, 136]] as const) {
    const p = fromGrid(nx, ny)
    assert.deepEqual(toGrid(p.lat, p.lon), { nx, ny })
  }
})

test('하버사인 거리: 서울 시청 - 부산 시청은 약 325km이다', () => {
  const seoul = { lat: 37.5665, lon: 126.978 }
  const busan = { lat: 35.1796, lon: 129.0756 }
  const km = haversineKm(seoul, busan, CONFIG.kmaGrid.earthRadiusKm)
  assert.ok(km > 315 && km < 335, `거리 ${km}`)
})

test('같은 점의 거리는 0이다', () => {
  const p = { lat: 37.5, lon: 127 }
  assert.equal(haversineKm(p, p, CONFIG.kmaGrid.earthRadiusKm), 0)
})
