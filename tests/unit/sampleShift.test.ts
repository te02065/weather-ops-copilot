/**
 * 이 파일이 하는 일: analysis/sampleShift.ts 테스트 (합성 샘플 날짜를 7의 배수만큼 옮기기).
 * 입력: 작은 CSV 예시
 * 출력: 테스트 통과/실패
 * 주의점: 요일이 바뀌면 샘플의 주말 효과가 깨지므로, 옮기는 날 수는 항상 7의 배수여야 합니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { dayOfWeek } from '../../analysis/dates'
import { lastDateOf, shiftCsvDates, weekShiftDays } from '../../analysis/sampleShift'

test('옮기는 날 수는 7의 배수이고 마지막 날이 목표 근처에 온다', () => {
  const shift = weekShiftDays('2026-02-04', '2026-11-04')
  assert.equal(shift % 7, 0)
  assert.ok(Math.abs(shift - 273) <= 3)
})

test('날짜를 옮겨도 요일은 그대로다', () => {
  const csv = 'date,sales\n2026-01-01,100\n2026-01-02,200\n'
  const moved = shiftCsvDates(csv, 287)
  const first = moved.split('\n')[1]!.split(',')[0]!
  assert.equal(dayOfWeek(first), dayOfWeek('2026-01-01'))
  assert.equal(moved.split('\n')[0], 'date,sales') // 헤더는 그대로
  assert.ok(moved.includes(',100'))
})

test('마지막 날짜는 빈 줄을 건너뛰고 읽는다', () => {
  assert.equal(lastDateOf('date,sales\n2026-01-01,1\n2026-01-02,2\n\n'), '2026-01-02')
  assert.equal(lastDateOf('date,sales\n'), null)
})
