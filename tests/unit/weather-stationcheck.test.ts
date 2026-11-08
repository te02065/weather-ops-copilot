/**
 * 이 파일이 하는 일: weather/stationCheck.ts 테스트 (빈 줄, 공백, 좌표 오류, 중복 운영 지점, 필수 열 누락).
 * 입력: 테스트 안에 적은 작은 CSV (합성 예시, 실제 지점 아님)
 * 출력: 테스트 통과/실패
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { checkStationCsv } from '../../weather/stationCheck'

const HEADER = '지점,시작일,종료일,지점명,지점주소,관리관서,위도,경도,강우계(관측장비지상높이(m))'

test('빈 첫 줄과 칸 앞뒤 공백이 있어도 오류 없이 읽는다', () => {
  const text = `\r\n${HEADER}\r\n 901 ,2010-01-01,, 가짜지점 ,주소,,37.5,127.0, 1.5 \r\n`
  const r = checkStationCsv(text, 'ASOS')
  assert.equal(r.totalRows, 1)
  assert.equal(r.activeIds, 1)
  assert.equal(r.activeWithRainGauge, 1)
  assert.deepEqual(r.issues, [])
})

test('좌표가 비어 있거나 대한민국 범위 밖이면 행 번호와 함께 알려 준다', () => {
  const text = `${HEADER}\n901,2010-01-01,,가짜A,,,,127.0,\n902,2010-01-01,,가짜B,,,10.0,127.0,\n`
  const r = checkStationCsv(text, 'AWS')
  assert.ok(r.issues.some((i) => i.includes('지점 901') && i.includes('위도')))
  assert.ok(r.issues.some((i) => i.includes('지점 902') && i.includes('대한민국 범위')))
})

test('운영 중인 같은 지점이 두 번 있으면 문제로 표시한다', () => {
  const text = `${HEADER}\n903,2010-01-01,,가짜C,,,37.5,127.0,\n903,2011-01-01,,가짜C,,,37.5,127.0,\n`
  const r = checkStationCsv(text, 'AWS')
  assert.ok(r.issues.some((i) => i.includes('지점 903') && i.includes('2개')))
})

test('종료된 지점(종료일 있음)은 운영 중으로 세지 않는다', () => {
  const text = `${HEADER}\n904,2000-01-01,2010-01-01,가짜D,,,37.5,127.0,1.5\n904,2010-01-01,,가짜D,,,37.5,127.0,\n`
  const r = checkStationCsv(text, 'ASOS')
  assert.equal(r.activeRows, 1)
  assert.equal(r.activeWithRainGauge, 0)
  assert.deepEqual(r.issues, [])
})

test('필수 열이 없으면 알려 준다', () => {
  const r = checkStationCsv('지점,위도\n905,37.5\n', 'ASOS')
  assert.ok(r.issues.some((i) => i.includes('필수 열이 없습니다') && i.includes('경도')))
})
