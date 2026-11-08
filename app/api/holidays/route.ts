/**
 * GET /api/holidays?start=2026-01-01&end=2026-12-31
 * 이 파일이 하는 일: 기간 안의 공휴일 목록을 한국천문연구원 특일 API에서 받아 돌려줍니다.
 * 입력: 시작일, 종료일 (YYYY-MM-DD)
 * 출력: { holidays: [{ date, name }] } 또는 오류 { code, message, hint }
 * 주의점: 서버에서만 실행됩니다. 키는 .env.local의 KASI_API_KEY를 읽고, 응답에는 넣지 않습니다.
 */

import { NextResponse } from 'next/server'
import { fetchHolidays, readKasiKey } from '@/holidays/kasiClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''
  if (!DATE.test(start) || !DATE.test(end)) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '날짜(YYYY-MM-DD)를 확인하세요.' }, { status: 400 })
  }
  const key = readKasiKey(process.env)
  if (!key.ok) {
    return NextResponse.json({ code: key.error.code, message: key.error.message, hint: key.error.hint }, { status: 500 })
  }
  const result = await fetchHolidays(start, end, key.key)
  if (!result.ok) {
    return NextResponse.json({ code: result.error.code, message: result.error.message, hint: result.error.hint }, { status: 502 })
  }
  return NextResponse.json({ holidays: result.holidays })
}
