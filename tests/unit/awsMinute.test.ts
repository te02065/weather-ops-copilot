/**
 * 이 파일이 하는 일: weather/awsMinute.ts 테스트 (AWS 매분자료 해석, -50 이하 결측, 하루 강수량).
 * 입력: 기상청 명세서 AWS 응답 예시 (tests/fixtures/kma-spec, 공개 예시값)
 * 출력: 테스트 통과/실패
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseAwsMinute, awsNumber, awsDailyPrecip } from '../../weather/awsMinute'

const SPEC = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'kma-spec', 'aws_min_spec_example.txt'), 'utf-8')

test('명세서 예시: 열 이름을 헤더에서 읽고 3분 자료를 행으로 만든다', () => {
  const r = parseAwsMinute(SPEC)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.rows.length, 3)
  assert.equal(r.rows[0]!.stn, '90')
  assert.equal(r.rows[0]!.values['TA'], 3.6)
  assert.equal(r.rows[0]!.values['RE'], 0)
})

test('-50 이하는 결측(null): 명세서의 -99.7, -99.9 같은 값', () => {
  assert.equal(awsNumber('-99.9'), null)
  assert.equal(awsNumber('-50'), null)
  assert.equal(awsNumber('-49.9'), -49.9)
  const r = parseAwsMinute(SPEC)
  assert.ok(r.ok && r.rows[1]!.values['RE'] === null)
})

test('하루 강수량은 일 누적(RN-DAY)의 하루 최댓값이다 (마지막 분이 0이어도)', () => {
  const rows = [
    { tm: '202610180900', stn: '108', values: { 'RN-DAY': 10 } },
    { tm: '202610182359', stn: '108', values: { 'RN-DAY': 51.4 } },
    { tm: '202610190000', stn: '108', values: { 'RN-DAY': 0 } },
    { tm: '202610182359', stn: '108', values: { 'RN-DAY': 0 } },
  ]
  assert.equal(awsDailyPrecip(rows, '2026-10-18'), 51.4)
  assert.equal(awsDailyPrecip(rows, '2026-10-20'), null)
})

test('열 이름 줄이 없으면 E_KMA_RESPONSE', () => {
  const r = parseAwsMinute('#START7777\n202302010900 90 1.0\n#7777END\n')
  assert.equal(r.ok, false)
})

test('분 자료 개수와 강수 감지 분 수를 센다', () => {
  const { awsDayCoverage } = require('../../weather/awsMinute') as typeof import('../../weather/awsMinute')
  const rows = [
    { tm: '202610180000', stn: '417', values: { RE: 0 } },
    { tm: '202610180001', stn: '417', values: { RE: 1 } },
  ]
  assert.deepEqual(awsDayCoverage(rows, '2026-10-18'), { minutes: 2, rainDetected: 1 })
})
