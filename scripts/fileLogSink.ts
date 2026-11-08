/**
 * 이 파일이 하는 일: 실행 로그를 data/logs/run-<runId>.jsonl 파일에 한 줄씩 저장합니다.
 * 입력: 프로젝트 폴더 경로, 현재 시각
 * 출력: runId, 파일 경로, 그리고 analysis/logger.ts의 configureLogger에 넘길 sink 함수
 * 주의점: Node에서만 실행합니다. 브라우저 코드에서 import하지 마세요 (파일 쓰기가 필요하기 때문).
 *         입력 파일의 SHA-256 해시를 계산하는 함수도 여기 있습니다. 파일 내용은 저장하지 않습니다.
 */

import { appendFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

/** 실행 ID: 2026-11-03_12-30-45 형식 (파일 이름에 쓸 수 있도록 콜론을 쓰지 않습니다). */
export function makeRunId(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `${date}_${time}`
}

/** 로그 파일을 만들고, 한 줄씩 덧붙이는 sink 함수를 돌려줍니다. */
export function createFileLogSink(baseDir: string, now: Date = new Date()) {
  const runId = makeRunId(now)
  const dir = join(baseDir, 'data', 'logs')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `run-${runId}.jsonl`)
  return {
    runId,
    filePath,
    sink: (line: string) => appendFileSync(filePath, `${line}\n`, 'utf-8'),
  }
}

/** 파일 내용의 SHA-256 (16진수). 같은 파일인지 확인하는 용도입니다. 글자(string) 또는 원본 바이트를 받습니다. */
export function sha256Of(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}
