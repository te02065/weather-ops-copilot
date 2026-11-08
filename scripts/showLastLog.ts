/**
 * 이 파일이 하는 일: 가장 최근 실행 로그(data/logs/run-*.jsonl)를 읽어 단계별 결과와 실패 내용을 보여 줍니다.
 * 입력: data/logs 폴더 안의 로그 파일 (실행 명령: npm run logs -- --last)
 * 출력: 콘솔에 실행 ID, 단계별 결과, 오류 코드·메시지·해결 방법
 * 주의점: 로그에는 매출 값이 없습니다. 이 명령은 로그를 읽기만 하고 아무것도 고치지 않습니다.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

interface LogLine {
  time: string
  runId: string
  stage: string
  event: 'start' | 'end' | 'warn' | 'error'
  ms?: number
  outCount?: number
  code?: string
  message?: string
  hint?: string
}

function findLatestLogFile(dir: string): string | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => f.startsWith('run-') && f.endsWith('.jsonl')).sort()
  return files.length > 0 ? join(dir, files[files.length - 1]!) : null
}

function printRun(lines: LogLine[]): void {
  console.log(`실행 ID: ${lines[0]!.runId}`)
  for (const l of lines.filter((x) => x.event === 'end')) {
    const ms = l.ms !== undefined ? ` · ${l.ms}ms` : ''
    const rows = l.outCount !== undefined ? ` · ${l.outCount}행` : ''
    console.log(`✔ ${l.stage} 끝${ms}${rows}`)
  }
  const errors = lines.filter((x) => x.event === 'error')
  for (const e of errors) {
    console.log(`✖ ${e.stage} 오류 [${e.code}]: ${e.message}`)
    if (e.hint) console.log(`  → ${e.hint}`)
  }
  const warnCount = lines.filter((x) => x.event === 'warn').length
  if (warnCount > 0) console.log(`경고 ${warnCount}건 기록됨`)
  console.log(errors.length > 0 ? '결과: 실패' : '결과: 성공')
}

function main(): void {
  const file = findLatestLogFile(join(process.cwd(), 'data', 'logs'))
  if (file === null) {
    console.log('로그가 없습니다. 먼저 npm run analyze -- <CSV 파일> --date <열> --sales <열> 을 실행하세요.')
    return
  }
  const lines = readFileSync(file, 'utf-8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as LogLine)
  console.log(`로그 파일: ${file}`)
  printRun(lines)
}

main()
