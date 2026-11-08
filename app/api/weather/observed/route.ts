/**
 * GET /api/weather/observed?stationId=108&start=2026-01-01&end=2026-01-31
 * 이 파일이 하는 일: 기상청 관측 일자료를 돌려줍니다. 캐시에 있으면 기상청을 부르지 않습니다.
 * 입력: 관측소 번호, 시작일, 종료일 (YYYY-MM-DD)
 * 출력: { days, missing, stale, warning } 또는 오류 { code, message, hint }
 * 주의점: 서버에서만 실행됩니다. 키는 .env.local의 KMA_API_KEY를 읽고, 응답에는 키를 넣지 않습니다.
 */

import { NextResponse } from 'next/server'
import { getObservedDaily } from '@/weather/observed'
import { fetchAsosText } from '@/weather/kmaClient'
import { readKmaKey } from '@/weather/kmaKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const stationId = searchParams.get('stationId') ?? ''
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''
  if (!/^\d+$/.test(stationId) || !DATE.test(start) || !DATE.test(end)) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '관측소 번호와 날짜(YYYY-MM-DD)를 확인하세요.' }, { status: 400 })
  }
  const key = readKmaKey(process.env)
  if (!key.ok) {
    return NextResponse.json({ code: key.error.code, message: key.error.message, hint: key.error.hint }, { status: 500 })
  }
  const result = await getObservedDaily({
    stationId,
    start,
    end,
    fetchChunk: (chunk) => fetchAsosText({ stationId, start: chunk.start, end: chunk.end }, key.key),
  })
  if (!result.ok) {
    return NextResponse.json({ code: result.error.code, message: result.error.message, hint: result.error.hint }, { status: 502 })
  }
  return NextResponse.json({
    days: result.days,
    missing: result.missing,
    stale: result.stale,
    warning: result.error?.message ?? null,
  })
}
