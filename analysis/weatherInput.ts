/**
 * 이 파일이 하는 일: 날씨 CSV(테스트용 또는 직접 준비한 파일)를 DailyWeather 목록으로 읽습니다.
 * 입력: CSV 텍스트. 열 이름은 date, precipMm, tempAvg, tempMax, tempMin, windMs 입니다.
 * 출력: DailyWeather 배열 (빈 칸은 null), 파싱 오류 목록
 * 주의점: 열 이름을 추정하지 않습니다. 날짜 형식이 틀리면 그 줄은 건너뛰고 오류로 알려 줍니다.
 *         실제 운영에서는 기상청 캐시(weather/cache.ts)를 씁니다. 이 파일은 합성 데이터와 테스트용입니다.
 */

import { readCsvText, parseAmount } from './csv'
import { parseIsoDate } from './dates'
import { makeStageError, type StageError } from './errors'
import type { DailyWeather } from './types'

const COLUMNS = ['date', 'precipMm', 'tempAvg', 'tempMax', 'tempMin', 'windMs'] as const

export function parseWeatherCsv(text: string): { rows: DailyWeather[]; errors: StageError[] } {
  const read = readCsvText(text)
  const errors: StageError[] = [...read.errors]
  const missing = COLUMNS.filter((c) => !read.fields.includes(c))
  if (missing.length > 0) {
    errors.push(makeStageError('weather.join', 'E_CSV_PARSE',
      `날씨 파일에 열이 없습니다: ${missing.join(', ')}`, '열 이름을 date, precipMm, tempAvg, tempMax, tempMin, windMs 로 맞추세요.'))
    return { rows: [], errors }
  }
  const rows: DailyWeather[] = []
  for (const r of read.records) {
    const date = parseIsoDate(r.values.date ?? '')
    if (date === null) {
      errors.push(makeStageError('weather.join', 'E_BAD_DATE', `날씨 파일 ${r.line}번째 줄의 날짜를 읽을 수 없습니다.`,
        '날짜를 2026-03-01 형식으로 고치세요.', r.line))
      continue
    }
    rows.push({
      date,
      precipMm: num(r.values.precipMm),
      tempAvg: num(r.values.tempAvg),
      tempMax: num(r.values.tempMax),
      tempMin: num(r.values.tempMin),
      windMs: num(r.values.windMs),
    })
  }
  return { rows, errors }
}

function num(text: string | undefined): number | null {
  return parseAmount(text).value
}
