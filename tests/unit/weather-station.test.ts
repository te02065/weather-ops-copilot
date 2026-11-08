/**
 * 이 파일이 하는 일: weather/station.ts 테스트 (확정 전 상태, 가장 가까운 관측소, 30km 경고).
 * 입력: 테스트 안에 적은 관측소 목록 (합성 좌표)
 * 출력: 테스트 통과/실패
 * 주의점: 관측소 번호는 테스트에서도 임의의 가짜 번호만 씁니다. 실제 번호는 지점정보 조회로 확정합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'path'
import { nearestStation, loadStationList } from '../../weather/station'
import type { StationList } from '../../weather/types'

const STATIONS: StationList = {
  confirmed: true,
  stations: [
    { id: 'T-001', name: '가짜 지점 A', lat: 37.5, lon: 127.0 },
    { id: 'T-002', name: '가짜 지점 B', lat: 36.0, lon: 127.0 },
  ],
}

test('목록이 확정되지 않으면 관측소를 고르지 않고 [확인 필요]를 돌려준다', () => {
  const r = nearestStation({ lat: 37.5, lon: 127.0 }, { confirmed: false, stations: STATIONS.stations })
  assert.deepEqual(r, { status: 'unconfirmed', note: '[확인 필요]' })
})

test('빈 목록도 [확인 필요]이다', () => {
  assert.equal(nearestStation({ lat: 37.5, lon: 127 }, { confirmed: true, stations: [] }).status, 'unconfirmed')
})

test('가장 가까운 관측소를 고르고, 거리 안이면 경고가 없다', () => {
  const r = nearestStation({ lat: 37.52, lon: 127.02 }, STATIONS)
  assert.equal(r.status, 'ok')
  if (r.status !== 'ok') return
  assert.equal(r.station.id, 'T-001')
  assert.equal(r.warning, false)
})

test('관측소가 30km보다 멀면 경고를 켠다', () => {
  // 위도 1도 ≈ 111km. 0.5도 떨어진 곳은 약 55km
  const r = nearestStation({ lat: 37.0, lon: 127.0 }, { confirmed: true, stations: [STATIONS.stations[0]!] })
  assert.equal(r.status, 'ok')
  if (r.status !== 'ok') return
  assert.equal(r.warning, true)
})

test('목록 파일이 없으면 확정되지 않은 빈 목록이다', () => {
  const list = loadStationList(join(process.cwd(), 'data', 'no-such-dir', 'stations.json'))
  assert.deepEqual(list, { confirmed: false, stations: [] })
})
