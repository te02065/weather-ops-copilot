/**
 * 이 파일이 하는 일: 단계의 시작·끝·경고·오류를 한 줄짜리 기록(JSON)으로 만듭니다.
 * 입력: 단계 이름(stage), 이벤트(start/end/warn/error), 기록할 값(data)
 * 출력: 기록 객체. 설정된 sink가 있으면 sink에 한 줄(JSON 문자열)을 넘깁니다.
 * 주의점: 이 파일은 파일을 직접 쓰지 않습니다 (브라우저에서도 쓸 수 있어야 하므로).
 *         파일 저장은 scripts/fileLogSink.ts가 맡습니다. 기록하는 항목은 아래 whitelist로만 제한합니다.
 *         매출 원래 값, 날짜별 매출, 상호명, 주소, API 키는 어떤 경우에도 기록하지 않습니다.
 */

import type { Stage } from './errors'

export type LogEvent = 'start' | 'end' | 'warn' | 'error'

/** 호출하는 쪽이 넘길 수 있는 값. 여기 없는 키는 버립니다. */
export interface LogData {
  ms?: number        // 소요 시간 (밀리초)
  inCount?: number   // 입력 건수
  outCount?: number  // 출력 건수
  code?: string      // 오류·경고 코드
  message?: string   // 한국어 메시지 (열 이름, 행 번호만)
  hint?: string      // 해결 방법 한 문장 (매출 값 없음)
  sha256?: string   // 입력 파일의 해시 (파일 내용은 남기지 않음, 같은 파일인지 확인용)
}

export interface LogRecord extends LogData {
  time: string
  runId: string
  stage: Stage
  event: LogEvent
}

type Sink = (line: string) => void

let currentRunId = 'no-run'
let currentSink: Sink | null = null

/** 실행을 시작할 때 한 번 호출합니다. runId와 기록을 보낼 곳(sink)을 정합니다. */
export function configureLogger(options: { runId: string; sink: Sink }): void {
  currentRunId = options.runId
  currentSink = options.sink
}

/** 단계 기록을 한 줄 남깁니다. 기록 객체를 돌려주므로 테스트에서 확인할 수 있습니다. */
export function log(stage: Stage, event: LogEvent, data: LogData = {}): LogRecord {
  const record: LogRecord = {
    time: new Date().toISOString(),
    runId: currentRunId,
    stage,
    event,
    ...pickAllowed(data),
  }
  currentSink?.(JSON.stringify(record))
  return record
}

/** whitelist: 허용된 키만 골라 냅니다. */
function pickAllowed(data: LogData): LogData {
  const out: LogData = {}
  if (data.ms !== undefined) out.ms = data.ms
  if (data.inCount !== undefined) out.inCount = data.inCount
  if (data.outCount !== undefined) out.outCount = data.outCount
  if (data.code !== undefined) out.code = data.code
  if (data.message !== undefined) out.message = data.message
  if (data.hint !== undefined) out.hint = data.hint
  if (data.sha256 !== undefined) out.sha256 = data.sha256
  return out
}
