/**
 * 이 파일이 하는 일: weather/midFcst.ts 테스트 (중기 응답 읽기, 날짜 맞추기).
 * 입력: 실제 응답 형식의 짧은 XML 예시 (대구 11H10701, 11H10000 형식)
 * 출력: 테스트 통과/실패
 * 주의점: 실제 호출은 하지 않습니다. 발표 06시 기준 +5일이 11/12, +6일이 11/13입니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { midDates, parseMid, xmlValue } from '../../weather/midFcst'

const TA = '<items><item><regId>11H10701</regId><taMin5>5</taMin5><taMax5>17</taMax5><taMin6>7</taMin6><taMax6>16</taMax6></item></items>'
const LAND = '<items><item><regId>11H10000</regId><rnSt5Am>10</rnSt5Am><rnSt5Pm>60</rnSt5Pm><rnSt6Am>10</rnSt6Am><rnSt6Pm>10</rnSt6Pm><wf5Am>맑음</wf5Am><wf5Pm>구름많음</wf5Pm><wf6Am>맑음</wf6Am><wf6Pm>맑음</wf6Pm></item></items>'

test('XML 값 읽기: 비슷한 이름(taMin5Low)과 섞이지 않는다', () => {
  assert.equal(xmlValue('<taMin5Low>1</taMin5Low><taMin5>5</taMin5>', 'taMin5'), '5')
  assert.equal(xmlValue('<a>1</a>', 'b'), null)
})

test('발표 06시 기준 +4일부터 +10일까지 날짜를 만든다 (11/11 ~ 11/17)', () => {
  const dates = midDates('20261107')
  assert.equal(dates[0]!.date, '2026-11-11')
  assert.equal(dates[1]!.date, '2026-11-12')
  assert.equal(dates[2]!.date, '2026-11-13')
  assert.equal(dates.length, 7)
})

test('11/12(+5일)와 11/13(+6일) 값: 기온 최저·최고, 오전·오후 강수확률, 날씨', () => {
  const days = parseMid(TA, LAND, '20261107')
  assert.deepEqual(days['2026-11-12'], { taMin: 5, taMax: 17, rnStAm: 10, rnStPm: 60, wfAm: '맑음', wfPm: '구름많음' })
  assert.equal(days['2026-11-13']!.taMax, 16)
  assert.equal(days['2026-11-14']!.taMin, null)
})

test('8일 뒤 이후는 오전·오후 구분 없이 하루 값을 쓴다 (11/15 = +8일)', () => {
  const land = '<items><item><rnSt8>30</rnSt8><wf8>흐림</wf8></item></items>'
  const days = parseMid(TA, land, '20261107')
  assert.deepEqual(days['2026-11-15'], { taMin: null, taMax: null, rnStAm: 30, rnStPm: null, wfAm: '흐림', wfPm: null })
})
