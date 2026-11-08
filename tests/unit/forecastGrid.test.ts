/**
 * 이 파일이 하는 일: weather/forecastGrid.ts 테스트 (격자 값 읽기 방향, 결측, 범위 밖)와
 *   격자 좌표표(weather/reference/grid_points.csv)와 위경도→격자 변환의 일치율을 확인합니다.
 * 입력: 가짜 격자 값 (값 = 행 번호), 좌표표 파일
 * 출력: 테스트 통과/실패
 * 주의점: 좌표표와 변환 결과가 100% 같지는 않습니다 (격자 경계 반올림 차이, 2026-11-05 검증: 98.8%).
 *         그래서 일치율 98% 이상을 기준으로 봅니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { GRID_HEIGHT, GRID_WIDTH, gridValueAt, parseGridValues } from '../../weather/forecastGrid'
import { toGrid } from '../../weather/grid'

test('격자 값: 맨 앞 줄이 ny=1(남쪽)이고, 가로 149칸씩 줄을 이룬다', () => {
  // 값 = 칸의 순서 번호를 1000으로 나눈 나머지로 채웁니다. 맨 앞 칸만 7로 표시해 위치를 확인합니다.
  const values = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => (i === 0 ? 7 : i % 1000))
  assert.equal(gridValueAt(values, 1, 1), 7)
  assert.equal(gridValueAt(values, 2, 1), 1)
  assert.equal(gridValueAt(values, 1, 2), GRID_WIDTH % 1000)
})

test('격자 값: 결측(-99)과 범위 밖 칸은 null', () => {
  const values = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => -99)
  assert.equal(gridValueAt(values, 58, 125), null)
  assert.equal(gridValueAt(values, 0, 1), null)
  assert.equal(gridValueAt(values, GRID_WIDTH + 1, 1), null)
  assert.equal(gridValueAt(values, 1, GRID_HEIGHT + 1), null)
})

test('응답 글자 읽기: 줄바꿈과 쉼표 모두 구분자', () => {
  assert.deepEqual(parseGridValues(' -99.00,  12.00,\n  -99.00,\n 3.50 '), [-99, 12, -99, 3.5])
})

test('좌표표와 위경도→격자 변환: 98% 이상 일치', () => {
  const text = readFileSync(join(process.cwd(), 'weather', 'reference', 'grid_points.csv'), 'utf-8')
  let total = 0
  let same = 0
  for (const line of text.split(/\r?\n/).slice(1)) {
    const f = line.split(',')
    const nx = Number(f[5])
    const ny = Number(f[6])
    const lon = Number(f[13])
    const lat = Number(f[14])
    if (!Number.isFinite(nx) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    total += 1
    const g = toGrid(lat, lon)
    if (g.nx === nx && g.ny === ny) same += 1
  }
  assert.ok(total > 3000, `좌표 행이 적습니다: ${total}`)
  assert.ok(same / total >= 0.98, `일치율 ${((same / total) * 100).toFixed(1)}%`)
})

test('매장 칸: 금천구 가산동 좌표는 격자 (58, 125)', () => {
  assert.deepEqual(toGrid(37.474125, 126.893808), { nx: 58, ny: 125 })
})
