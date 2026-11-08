/**
 * GET /api/sample-data
 * 이 파일이 하는 일: 합성(가짜) 샘플 매출과 날씨를 돌려줍니다. 화면에서 "샘플" 표시와 함께 씁니다.
 * 입력: 없음 (tests/fixtures/synthetic의 합성 파일을 읽음)
 * 출력: { source: "synthetic", shiftDays, sales: CSV 글자, weather: CSV 글자 }
 * 주의점: 실제 매출이 아닙니다. 결과 화면에 반드시 "합성 데이터" 배지를 붙입니다.
 *         날짜는 마지막 날이 어제(기상청 자료 기준)에 오도록 7의 배수만큼 옮겨 줍니다. 과거 날짜가 예측 대상으로 뜨지 않게 하려는 것입니다.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { CONFIG } from '@/analysis/config'
import { addDaysIso, localTodayIso } from '@/analysis/dates'
import { lastDateOf, shiftCsvDates, weekShiftDays } from '@/analysis/sampleShift'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  const dir = join(process.cwd(), 'tests', 'fixtures', 'synthetic')
  const sales = readFileSync(join(dir, 'synthetic_pipeline_sales_400d.csv'), 'utf-8')
  const weather = readFileSync(join(dir, 'synthetic_pipeline_weather_400d.csv'), 'utf-8')
  const last = lastDateOf(sales)
  const yesterday = addDaysIso(localTodayIso(), -CONFIG.kmaLatestLagDays)
  const shiftDays = last ? weekShiftDays(last, yesterday) : 0
  return NextResponse.json({
    source: 'synthetic',
    shiftDays,
    sales: shiftCsvDates(sales, shiftDays),
    weather: shiftCsvDates(weather, shiftDays),
  })
}
