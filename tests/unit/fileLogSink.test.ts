/**
 * 이 파일이 하는 일: scripts/fileLogSink.ts 테스트 (실행 ID 형식, 로그 파일 저장, SHA-256).
 * 입력: 임시 폴더 (os.tmpdir 아래에 만들고 테스트 끝에 지움), 고정된 시각
 * 출력: 테스트 통과/실패
 * 주의점: 실제 data/logs 폴더를 건드리지 않습니다. 테스트 전용 임시 폴더만 씁니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { makeRunId, createFileLogSink, sha256Of } from '../../scripts/fileLogSink'

test('실행 ID는 날짜_시분초 형식이다 (파일 이름에 쓸 수 있음)', () => {
  assert.equal(makeRunId(new Date(2026, 10, 3, 12, 30, 45)), '2026-11-03_12-30-45')
})

test('sink에 쓴 줄은 data/logs/run-<runId>.jsonl 파일에 한 줄씩 저장된다', () => {
  const base = mkdtempSync(join(tmpdir(), 'wedoc-test-'))
  try {
    const { runId, filePath, sink } = createFileLogSink(base, new Date(2026, 10, 3, 9, 0, 0))
    sink('{"a":1}')
    sink('{"a":2}')
    assert.equal(runId, '2026-11-03_09-00-00')
    assert.ok(filePath.endsWith(join('data', 'logs', 'run-2026-11-03_09-00-00.jsonl')))
    assert.equal(readFileSync(filePath, 'utf-8'), '{"a":1}\n{"a":2}\n')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('SHA-256은 같은 입력에 같은 값을 내고, 알려진 값과 같다', () => {
  assert.equal(sha256Of('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(sha256Of('abc'), sha256Of('abc'))
})
