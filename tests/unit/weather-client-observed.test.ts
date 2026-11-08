/**
 * 이 파일이 하는 일: weather/kmaClient.ts(재시도, 키 가림, 권한 오류)와 weather/observed.ts(캐시, 재요청 없음, stale)를 테스트합니다.
 * 입력: 가짜 fetch 함수, 명세서 형식으로 만든 가짜 응답, 임시 폴더
 * 출력: 테스트 통과/실패
 * 주의점: 이 테스트는 기상청에 연결하지 않습니다. 가짜 fetch만 씁니다.
 *         임시 폴더는 테스트가 끝나면 지웁니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CONFIG } from '../../analysis/config'
import { makeStageError } from '../../analysis/errors'
import { fetchAsosText, type FetchLike } from '../../weather/kmaClient'
import { getObservedDaily } from '../../weather/observed'
import { cacheFilePath } from '../../weather/cache'
import type { DateChunk } from '../../weather/asos'
import type { AsosFetchResult } from '../../weather/kmaClient'

const FAKE_KEY = 'FAKE-KEY-999'
const noSleep = async () => {}

/** 명세서 형식의 응답을 만듭니다 (열 번호 목록 + 행). 날짜는 YYYYMMDD 목록입니다. */
function responseFor(dates: string[]): string {
  const names = ['TM', 'TA_AVG', 'TA_MAX', 'TA_MIN', 'RN_DAY']
  const head = names.map((n, i) => `# ${i + 1}. ${n} : 테스트 열`).join('\n')
  const rows = dates.map((d) => `${d} 5.0 9.0 1.0 0.0`).join('\n')
  return `START7777\n${head}\n${rows}\n#7777END\n`
}

const DATES = ['20260101', '20260102', '20260103']

function okFetch(body: string, calls: string[]): FetchLike {
  return async (url) => {
    calls.push(url)
    return { ok: true, status: 200, text: async () => body }
  }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wedoc-weather-'))
}

test('요청 주소에 키와 YYYYMMDD 기간이 붙는다 (kma_sfcdd3, help=1)', async () => {
  const calls: string[] = []
  const r = await fetchAsosText({ stationId: '108', start: '2026-01-01', end: '2026-01-31' }, FAKE_KEY, okFetch(responseFor(DATES), calls))
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0]!.includes('kma_sfcdd3.php'))
  assert.ok(calls[0]!.includes('authKey=FAKE-KEY-999'))
  assert.ok(calls[0]!.includes('tm1=20260101') && calls[0]!.includes('tm2=20260131'))
  assert.ok(calls[0]!.includes('help=1'))
})

test('실패하면 1 + 재시도 횟수만큼 시도하고, 오류 메시지에 키가 없다', async () => {
  let count = 0
  const failing: FetchLike = async () => {
    count++
    throw new Error(`네트워크 끊김 ${FAKE_KEY}`)
  }
  const r = await fetchAsosText({ stationId: '108', start: '2026-01-01', end: '2026-01-31' }, FAKE_KEY, failing)
  assert.equal(count, 1 + CONFIG.kmaRetryCount)
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.code, 'E_KMA_FETCH')
  assert.ok(!r.error.message.includes(FAKE_KEY))
})

test('HTTP 500 같은 서버 오류는 재시도한다', async () => {
  let count = 0
  const bad: FetchLike = async () => {
    count++
    return { ok: false, status: 500, text: async () => '' }
  }
  const r = await fetchAsosText({ stationId: '108', start: '2026-01-01', end: '2026-01-02' }, FAKE_KEY, bad)
  assert.equal(r.ok, false)
  assert.equal(count, 1 + CONFIG.kmaRetryCount)
})

test('403 권한 없음은 재시도하지 않고, 활용신청 확인 안내를 준다', async () => {
  let count = 0
  const denied: FetchLike = async () => {
    count++
    return { ok: false, status: 403, text: async () => '' }
  }
  const r = await fetchAsosText({ stationId: '108', start: '2026-01-01', end: '2026-01-31' }, FAKE_KEY, denied)
  assert.equal(count, 1)
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.error.message.includes('403'))
  assert.ok(r.error.hint.includes('활용신청'))
})

test('캐시에 모든 날짜가 있으면 기상청을 부르지 않는다', async () => {
  const dir = tempDir()
  try {
    const days: Record<string, unknown> = {}
    for (const d of ['2026-01-01', '2026-01-02', '2026-01-03']) {
      days[d] = { date: d, stationId: '108', precipMm: 0, tempAvg: 1, tempMax: 2, tempMin: 0, stale: false }
    }
    writeFileSync(cacheFilePath('108', dir), JSON.stringify({ stationId: '108', days }), 'utf-8')
    let calls = 0
    const r = await getObservedDaily({
      stationId: '108', start: '2026-01-01', end: '2026-01-03', cacheDir: dir, today: '2026-02-01',
      fetchChunk: async () => { calls++; return { ok: true, text: responseFor(DATES) } },
      sleep: noSleep,
    })
    assert.equal(calls, 0)
    assert.ok(r.ok && r.days.length === 3 && r.stale === false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('없는 날짜만 받아 캐시에 저장하고, 두 번째 호출은 기상청을 부르지 않는다', async () => {
  const dir = tempDir()
  try {
    let calls = 0
    const fetchChunk = async (_c: DateChunk): Promise<AsosFetchResult> => {
      calls++
      return { ok: true, text: responseFor(DATES) }
    }
    const first = await getObservedDaily({ stationId: '108', start: '2026-01-01', end: '2026-01-03', cacheDir: dir, today: '2026-02-01', fetchChunk, sleep: noSleep })
    assert.ok(first.ok && first.days.length === 3 && first.stale === false)
    assert.equal(calls, 1)
    const second = await getObservedDaily({ stationId: '108', start: '2026-01-01', end: '2026-01-03', cacheDir: dir, today: '2026-02-01', fetchChunk, sleep: noSleep })
    assert.equal(calls, 1)
    assert.ok(second.ok && second.days.length === 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('31일을 넘는 기간은 여러 번에 나눠 요청한다', async () => {
  const dir = tempDir()
  try {
    let calls = 0
    const fetchChunk = async (): Promise<AsosFetchResult> => { calls++; return { ok: true, text: responseFor(DATES) } }
    await getObservedDaily({ stationId: '108', start: '2026-01-01', end: '2026-02-15', cacheDir: dir, today: '2026-03-01', fetchChunk, sleep: noSleep })
    assert.equal(calls, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('요청이 실패하면 캐시 값을 stale 표시와 함께 쓴다', async () => {
  const dir = tempDir()
  try {
    const days = { '2026-01-01': { date: '2026-01-01', stationId: '108', precipMm: 0, tempAvg: 1, tempMax: 2, tempMin: 0, stale: false } }
    writeFileSync(cacheFilePath('108', dir), JSON.stringify({ stationId: '108', days }), 'utf-8')
    const failing = async (): Promise<AsosFetchResult> => ({
      ok: false,
      error: makeStageError('weather.fetch', 'E_KMA_FETCH', '실패', '확인'),
    })
    const r = await getObservedDaily({ stationId: '108', start: '2026-01-01', end: '2026-01-03', cacheDir: dir, today: '2026-02-01', fetchChunk: failing, sleep: noSleep })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.days.length, 1)
    assert.equal(r.days[0]!.stale, true)
    assert.deepEqual(r.missing, ['2026-01-02', '2026-01-03'])
    assert.equal(r.error?.code, 'E_KMA_FETCH')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('캐시도 없고 요청도 실패하면 오류를 돌려준다', async () => {
  const dir = tempDir()
  try {
    const failing = async (): Promise<AsosFetchResult> => ({
      ok: false,
      error: makeStageError('weather.fetch', 'E_KMA_FETCH', '실패', '확인'),
    })
    const r = await getObservedDaily({ stationId: '108', start: '2026-01-01', end: '2026-01-03', cacheDir: dir, today: '2026-02-01', fetchChunk: failing, sleep: noSleep })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.error.code, 'E_KMA_FETCH')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('아직 확정되지 않은 최근 날짜(어제 이후)는 요청하지 않는다', async () => {
  const dir = tempDir()
  try {
    const requested: DateChunk[] = []
    const fetchChunk = async (c: DateChunk): Promise<AsosFetchResult> => { requested.push(c); return { ok: true, text: responseFor(DATES) } }
    // 오늘이 01-03이면 확정된 마지막 날은 01-02 (kmaLatestLagDays = 1)
    const r = await getObservedDaily({
      stationId: '108', start: '2026-01-01', end: '2026-01-10', today: '2026-01-03',
      cacheDir: dir, fetchChunk, sleep: noSleep,
    })
    assert.equal(requested.length, 1)
    assert.equal(requested[0]!.end, '2026-01-02')
    assert.ok(r.ok && r.missing.length === 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('관측소 번호가 확정되지 않은 값([확인 필요])이면 요청하지 않는다', async () => {
  let calls = 0
  const r = await getObservedDaily({
    stationId: '[확인 필요]', start: '2026-01-01', end: '2026-01-03',
    fetchChunk: async () => { calls++; return { ok: true, text: responseFor(DATES) } },
    sleep: noSleep,
  })
  assert.equal(calls, 0)
  assert.equal(r.ok, false)
})
