/**
 * 이 파일이 하는 일: analysis/dates.ts 테스트 (날짜 형식, 없는 날짜, 요일).
 * 입력: 날짜 문자열 예시
 * 출력: 테스트 통과/실패
 * 주의점: 요일 테스트는 UTC 기준입니다. 시간대와 상관없이 같아야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIsoDate, dayOfWeek, daysBetween } from '../../analysis/dates'

test('허용된 날짜 형식은 모두 YYYY-MM-DD로 바뀐다', () => {
  assert.equal(parseIsoDate('2026-03-01'), '2026-03-01')
  assert.equal(parseIsoDate('2026/3/1'), '2026-03-01')
  assert.equal(parseIsoDate('2026.03.01'), '2026-03-01')
  assert.equal(parseIsoDate('20260301'), '2026-03-01')
  assert.equal(parseIsoDate(' 2026-03-01 '), '2026-03-01')
})

test('없는 날짜(2월 30일)와 잘못된 형식은 null이다', () => {
  assert.equal(parseIsoDate('2026-02-30'), null)
  assert.equal(parseIsoDate('2026-13-01'), null)
  assert.equal(parseIsoDate('2026-1-1-1'), null)
  assert.equal(parseIsoDate('어제'), null)
  assert.equal(parseIsoDate(''), null)
})

test('구분자가 섞인 날짜는 허용하지 않는다 (2026-03/01)', () => {
  assert.equal(parseIsoDate('2026-03/01'), null)
})

test('요일은 UTC 기준으로 나온다 (2026-03-01은 일요일)', () => {
  assert.equal(dayOfWeek('2026-03-01'), 0)
  assert.equal(dayOfWeek('2026-03-07'), 6)
  assert.equal(dayOfWeek('2026-03-02'), 1)
})

test('날 수 차이를 계산한다', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30)
  assert.equal(daysBetween('2026-03-01', '2026-01-01'), -59)
})

test('엑셀에서 보이는 날짜(2026. 3. 1.)와 한글 날짜(2026년 3월 1일)를 읽는다', () => {
  assert.equal(parseIsoDate('2026. 3. 1.'), '2026-03-01')
  assert.equal(parseIsoDate('2026. 3. 1'), '2026-03-01')
  assert.equal(parseIsoDate('2026년 3월 1일'), '2026-03-01')
  assert.equal(parseIsoDate('2026. 2. 30.'), null)
})

test('엑셀 날짜 번호(5자리)는 날짜로 바꾸고, 범위 밖 숫자는 날짜가 아니다', () => {
  assert.equal(parseIsoDate('46082'), '2026-03-01') // 2026-01-01 = 46023
  assert.equal(parseIsoDate('46023'), '2026-01-01')
  assert.equal(parseIsoDate('12345'), null)
})
