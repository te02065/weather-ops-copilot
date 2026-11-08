/**
 * 이 파일이 하는 일: analysis/logger.ts 테스트 (기록 형식, 허용 항목만 기록, 민감값 미기록).
 * 입력: log() 호출 예시 (테스트 안에 직접 적음)
 * 출력: 테스트 통과/실패
 * 주의점: 매출 원래 값, 상호명, 주소, API 키가 기록에 들어가면 안 됩니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { configureLogger, log } from '../../analysis/logger'

test('기록 한 줄에 time, runId, stage, event가 모두 있다', () => {
  const lines: string[] = []
  configureLogger({ runId: 'r1', sink: (l) => lines.push(l) })
  const record = log('ingest.parse', 'start')
  assert.equal(record.runId, 'r1')
  assert.equal(record.stage, 'ingest.parse')
  assert.equal(record.event, 'start')
  assert.ok(!Number.isNaN(Date.parse(record.time)))
  assert.equal(JSON.parse(lines[0]!).runId, 'r1')
})

test('허용된 항목(ms, inCount, outCount, code, message, sha256)은 그대로 기록된다', () => {
  configureLogger({ runId: 'r2', sink: () => {} })
  const record = log('ingest.validate', 'error', {
    ms: 12, inCount: 365, outCount: 360, code: 'E_BAD_DATE', message: '행 3', sha256: 'abc',
  })
  assert.equal(record.ms, 12)
  assert.equal(record.inCount, 365)
  assert.equal(record.code, 'E_BAD_DATE')
  assert.equal(record.sha256, 'abc')
})

test('허용되지 않은 항목(매출, 상호명, 주소, API 키)은 버린다', () => {
  const lines: string[] = []
  configureLogger({ runId: 'r3', sink: (l) => lines.push(l) })
  const data = {
    code: 'W_OUTLIER',
    totalSales: 2500000,
    storeName: '강남점',
    address: '서울시 어딘가',
    apiKey: 'NGm4-secret',
  } as Record<string, unknown>
  log('ingest.validate', 'warn', data as never)
  const text = lines.join('\n')
  assert.ok(!text.includes('2500000'))
  assert.ok(!text.includes('강남점'))
  assert.ok(!text.includes('서울시'))
  assert.ok(!text.includes('NGm4-secret'))
  assert.ok(text.includes('W_OUTLIER'))
})

test('sink가 없어도 기록 객체는 돌려주고 오류가 나지 않는다', () => {
  configureLogger({ runId: 'r4', sink: undefined as never })
  const record = log('ingest.parse', 'end', { outCount: 3 })
  assert.equal(record.outCount, 3)
})
