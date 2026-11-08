/**
 * 이 파일이 하는 일: weather/asos.ts(기간 나누기, 응답 해석)와 weather/kmaKey.ts(키 읽기) 테스트.
 * 입력: 기상청 명세서 응답 예시(tests/fixtures/kma-spec, 공개 예시값), 테스트 안의 작은 값
 * 출력: 테스트 통과/실패
 * 주의점: 키 테스트는 가짜 키 문자열만 씁니다. 실제 키는 테스트에 넣지 않습니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { splitDateRange, toKmaDate, parseAsosDaily, parseKmaNumber, buildAsosQuery, precipFrom } from '../../weather/asos'
import { readKmaKey, kmaKeyStatus, redactKey } from '../../weather/kmaKey'

const SPEC = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'kma-spec', 'asos_daily_spec_example.txt'), 'utf-8')

test('기간을 31일 단위로 나눈다 (46일 → 31일 + 15일)', () => {
  const chunks = splitDateRange('2026-01-01', '2026-02-15')
  assert.deepEqual(chunks, [
    { start: '2026-01-01', end: '2026-01-31' },
    { start: '2026-02-01', end: '2026-02-15' },
  ])
})

test('기간이 31일 이하면 한 조각이다', () => {
  assert.equal(splitDateRange('2026-01-01', '2026-01-31').length, 1)
})

test('YYYY-MM-DD → YYYYMMDD 변환과 요청 변수 (help=1, authKey는 없음)', () => {
  assert.equal(toKmaDate('2026-03-01'), '20260301')
  assert.deepEqual(buildAsosQuery('108', '2026-01-01', '2026-01-31'), { tm1: '20260101', tm2: '20260131', stn: '108', help: '1' })
})

test('명세서 응답 예시: 4일치를 읽고, 기온과 강수(-9.0은 결측)를 맞게 바꾼다', () => {
  const r = parseAsosDaily(SPEC, '108')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.days.length, 4)
  assert.deepEqual(r.days[0], { date: '2015-12-11', stationId: '108', precipMm: 0, tempAvg: 6.4, tempMax: 12.2, tempMin: 3.3, stale: false })
  assert.equal(r.days[2]!.precipMm, 0) // 12/13 RN_DAY = -9.0 = 무강수 (기온은 있음). RN_D99 = 0.0 은 쓰지 않습니다
})

test('열 번호 목록이 없으면 E_KMA_RESPONSE', () => {
  const r = parseAsosDaily('#START7777\n20151211 108 6.4\n#7777END\n', '108')
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.code, 'E_KMA_RESPONSE')
  assert.equal(r.error.stage, 'weather.fetch')
})

test('필수 열(TA_AVG 등)이 빠진 응답은 E_KMA_RESPONSE', () => {
  const r = parseAsosDaily('# 1. TM : 관측일\n# 2. STN : 지점\n20151211 108\n', '108')
  assert.equal(r.ok, false)
})

test('칸 수가 열 개수의 배수가 아니면 E_KMA_RESPONSE (줄이 잘린 응답)', () => {
  const text = '# 1. TM : a\n# 2. TA_AVG : b\n# 3. TA_MAX : c\n# 4. TA_MIN : d\n# 5. RN_DAY : e\n20260105 1 2 3\n'
  const r = parseAsosDaily(text, '108')
  assert.equal(r.ok, false)
})

test('여러 줄로 나뉜 행도 열 개수만큼 모아서 읽는다', () => {
  const text = '# 1. TM : a\n# 2. TA_AVG : b\n# 3. TA_MAX : c\n# 4. TA_MIN : d\n# 5. RN_DAY : e\n20260105 1.0 2.0\n3.0 0.5\n'
  const r = parseAsosDaily(text, '108')
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.days[0]!.tempAvg, 1)
  assert.equal(r.days[0]!.tempMin, 3)
  assert.equal(r.days[0]!.tempMin, 3)
  assert.equal(r.days[0]!.precipMm, 0.5)
})

test('빈 칸과 "-"는 결측(null)이다', () => {
  assert.equal(parseKmaNumber(''), null)
  assert.equal(parseKmaNumber('-'), null)
  assert.equal(parseKmaNumber('-9'), null)
  assert.equal(parseKmaNumber('0'), 0)
})

test('키가 없으면 안내 문구와 E_KMA_KEY_MISSING', () => {
  const r = readKmaKey({})
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.code, 'E_KMA_KEY_MISSING')
  assert.equal(r.error.message, 'KMA_API_KEY가 .env.local에 없습니다')
})

test('키가 공백만 있어도 없는 것으로 본다', () => {
  assert.equal(readKmaKey({ KMA_API_KEY: '   ' }).ok, false)
})

test('키가 있으면 키를 돌려주고, 상태 문구에는 키 값이 없다', () => {
  const env = { KMA_API_KEY: 'FAKE-KEY-123' }
  const r = readKmaKey(env)
  assert.ok(r.ok && r.key === 'FAKE-KEY-123')
  assert.equal(kmaKeyStatus(env), 'KMA_API_KEY 설정됨')
  assert.ok(!kmaKeyStatus(env).includes('FAKE-KEY-123'))
})

test('오류 문구 안의 키는 *** 로 가린다', () => {
  assert.equal(redactKey('연결 실패 FAKE-KEY-123 끝', 'FAKE-KEY-123'), '연결 실패 *** 끝')
})

test('일강수 -9: 기온이 있으면 0mm(무강수), 기온도 없으면 결측(null)', () => {
  assert.equal(precipFrom('-9.0', 5), 0)
  assert.equal(precipFrom('-9.0', null), null)
  assert.equal(precipFrom('2.4', null), 2.4)
})
