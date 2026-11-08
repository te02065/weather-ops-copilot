/**
 * 이 파일이 하는 일: 파이프라인의 모든 오류·경고를 같은 모양(StageError)으로 만듭니다.
 * 입력: 단계 이름, 오류 코드, 한국어 메시지, 해결 방법(hint), 행 번호(선택)
 * 출력: StageError 객체 { stage, code, message, hint, row? }
 * 주의점: message와 hint에는 매출 금액이나 상호명을 넣지 않습니다. 열 이름과 행 번호만 씁니다.
 */

export type Stage =
  | 'ingest.parse'
  | 'ingest.validate'
  | 'weather.fetch'
  | 'weather.join'
  | 'features.build'
  | 'baseline.run'
  | 'model.fit'
  | 'backtest.run'
  | 'forecast.predict'
  | 'briefing.check'
  | 'holiday.fetch'

export interface StageError {
  stage: Stage
  code: string      // 예: E_BAD_DATE, W_GAPS
  message: string   // 무엇이 잘못됐는지 (열 이름, 행 번호 포함)
  hint: string      // 무엇을 고치면 되는지 (한국어 한 문장)
  row?: number      // 엑셀 기준 행 번호 (헤더가 1행)
}

/** 메시지에 넣는 위치 표기. 엑셀에서 보이는 물리적 줄 번호와 같습니다 (헤더가 1번째 줄). */
export function atLine(line: number): string {
  return `파일 ${line}번째 줄`
}

export function makeStageError(
  stage: Stage,
  code: string,
  message: string,
  hint: string,
  row?: number,
): StageError {
  return row === undefined
    ? { stage, code, message, hint }
    : { stage, code, message, hint, row }
}
