/**
 * 이 파일이 하는 일: CSV 입력(2단계)에서 쓰는 데이터 모양(타입)을 정의합니다.
 * 입력: 없음 (타입 정의만 있습니다)
 * 출력: ColumnMapping, SalesInputRow, IngestSummary, IngestResult
 * 주의점: 열 이름은 사용자가 직접 고른 값만 씁니다. 파일 헤더에서 자동으로 추정하지 않습니다 (설계 F4).
 */

import type { StageError } from './errors'

/** 사용자가 고른 열 이름. date와 sales는 필수, 나머지는 선택입니다. */
export interface ColumnMapping {
  date: string
  sales: string
  transactions?: string
  iceSales?: string
  hotSales?: string
}

/** 검증을 통과한 한 행. 값이 없으면 null입니다 (0으로 바꾸지 않음). */
export interface SalesInputRow {
  row: number                 // 엑셀 기준 행 번호
  date: string                // YYYY-MM-DD
  sales: number | null        // null = 매출 칸이 비어 있음
  transactions: number | null
  iceSales: number | null
  hotSales: number | null
  flags: string[]             // 예: 'closed_candidate', 'outlier_candidate'
}

export interface IngestSummary {
  rowCount: number            // 읽은 데이터 행 수
  dateStart: string | null
  dateEnd: string | null
  validDays: number           // 매출이 0보다 큰 날 수 (유효 영업일 후보)
  zeroDays: number            // 매출 0원인 날 수 (휴무 후보)
  missingSalesCells: number   // 매출 칸이 비어 있는 행 수
  hasTransactions: boolean
  hasIceSales: boolean
  hasHotSales: boolean
}

export interface IngestResult {
  ok: boolean                 // 오류가 하나도 없으면 true
  rows: SalesInputRow[]       // 오류가 있어도 파싱된 행은 돌려줍니다 (화면 표시용)
  errors: StageError[]
  warnings: StageError[]
  summary: IngestSummary
}

/** 달력 입력 한 줄 (사용자가 입력). 공휴일 목록의 출처는 아직 확정되지 않았습니다 [확인 필요]. */
export interface CalendarEvent {
  date: string                                        // YYYY-MM-DD
  type: 'holiday' | 'closed' | 'promotion' | 'event'
  label?: string
}

/** 날씨 입력 한 줄 (하루). 값이 없으면 null입니다. */
export interface DailyWeather {
  date: string
  precipMm: number | null
  tempAvg: number | null
  tempMax: number | null
  tempMin: number | null
  windMs: number | null
  rainProbPct?: number | null  // 중기예보처럼 강수량 대신 강수확률만 있을 때 (0~100)
  popPct?: number | null       // 단기예보 강수확률 하루 최댓값 (0~100). 없으면 null
  sky?: SkyCode | null         // 하늘상태 하루 대표값. 없으면 null
}

/** 날짜별 특징 한 줄 (설계 §4 FeatureRow). */
export interface FeatureRow {
  date: string
  y: number | null                                    // 매출
  dow: number                                         // 0(일)~6(토)
  isHoliday: boolean
  isClosed: boolean
  isPromo: boolean
  rainBand: 'none' | 'light' | 'heavy' | null
  tempAvg: number | null
  tempMax: number | null
  tempMin: number | null
  comfortC?: number
  tempDelta?: number                                  // 전일 대비 일평균 기온 차 (기준일 이전 값만 사용)
  trendIdx: number                                    // 유효 영업일 인덱스 / 365
  weatherSource: 'observed' | 'forecast'
  flags: string[]
}

/** 하늘상태: 맑음, 구름많음, 흐림 (기상청 SKY 1·3·4와 중기예보 글자를 이 값으로 맞춥니다). */
export type SkyCode = 'clear' | 'cloudy' | 'overcast'
