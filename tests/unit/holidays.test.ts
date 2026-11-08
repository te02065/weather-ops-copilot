/**
 * 이 파일이 하는 일: holidays/kasi.ts 테스트 (월 목록, 조회 주소, 응답 읽기).
 * 입력: 특일 API 응답 예시 (JSON 문자열, 실제 응답 형식)
 * 출력: 테스트 통과/실패
 * 주의점: 실제 API는 부르지 않습니다. 키는 테스트용 가짜 값입니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRestDeUrl, monthsBetween, parseRestDeJson, redactServiceKey } from '../../holidays/kasi'

test('월 목록은 연도를 넘어가도 이어진다', () => {
  assert.deepEqual(monthsBetween('2026-11-20', '2027-02-01'), [
    { year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 2 },
  ])
})

test('시작이 종료보다 뒤면 빈 목록', () => {
  assert.deepEqual(monthsBetween('2026-05-01', '2026-03-01'), [])
})

test('최대 개월 수를 넘으면 null', () => {
  assert.equal(monthsBetween('2025-01-01', '2027-01-31'), null)
  assert.equal(monthsBetween('2025-01-01', '2026-12-31')?.length, 24)
})

test('인코딩된 키는 그대로, 디코딩된 키는 인코딩해서 주소에 넣는다', () => {
  const encoded = buildRestDeUrl({ year: 2026, month: 10 }, 'ab%2Fcd%3D%3D')
  assert.ok(encoded.includes('ServiceKey=ab%2Fcd%3D%3D&'))
  const decoded = buildRestDeUrl({ year: 2026, month: 10 }, 'ab/cd==')
  assert.ok(decoded.includes('ServiceKey=ab%2Fcd%3D%3D&'))
  assert.ok(decoded.includes('solYear=2026&solMonth=10&'))
})

test('공휴일 응답: 대체공휴일 포함, isHoliday N은 제외, 날짜를 YYYY-MM-DD로 바꾼다', () => {
  const text = JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items: { item: [
    { dateKind: '01', dateName: '개천절', isHoliday: 'Y', locdate: 20261003, seq: 1 },
    { dateKind: '01', dateName: '대체공휴일(개천절)', isHoliday: 'Y', locdate: 20261005, seq: 1 },
    { dateKind: '02', dateName: '단풍', isHoliday: 'N', locdate: 20261010, seq: 1 },
  ] }, numOfRows: 100, pageNo: 1, totalCount: 3 } } })
  const r = parseRestDeJson(text)
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.holidays, [
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '대체공휴일(개천절)' },
  ])
})

test('공휴일 응답: 한 건이면 객체로 와도 읽고, 자료가 없으면 빈 목록', () => {
  const one = JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'OK' }, body: { items: { item: { dateName: '한글날', isHoliday: 'Y', locdate: 20261009 } } } } })
  const r1 = parseRestDeJson(one)
  assert.ok(r1.ok && r1.holidays.length === 1 && r1.holidays[0]!.date === '2026-10-09')
  const none = JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'OK' }, body: { items: '', numOfRows: 100, pageNo: 1, totalCount: 0 } } })
  const r2 = parseRestDeJson(none)
  assert.ok(r2.ok && r2.holidays.length === 0)
})

test('특일 API 오류 코드는 E_HOLIDAY_RESPONSE로 알린다', () => {
  const text = JSON.stringify({ response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } })
  const r = parseRestDeJson(text)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.error.code, 'E_HOLIDAY_RESPONSE')
})

test('JSON이 아니면 오류', () => {
  const r = parseRestDeJson('<html>error</html>')
  assert.equal(r.ok, false)
})

test('오류 메시지에서 키를 가린다 (인코딩된 형태 포함)', () => {
  assert.equal(redactServiceKey('주소 ServiceKey=ab%2Fcd 실패', 'ab%2Fcd'), '주소 ServiceKey=*** 실패')
  assert.equal(redactServiceKey('주소 ServiceKey=ab/cd 실패', 'ab/cd'), '주소 ServiceKey=*** 실패')
})
