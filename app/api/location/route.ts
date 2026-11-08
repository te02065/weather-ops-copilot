/**
 * POST /api/location
 * 이 파일이 하는 일: 주소를 위도와 경도로 바꾸는 자리입니다. 아직 변환 업체를 정하지 않았습니다 (설계 §12).
 * 출력: 501 + 안내. 화면은 위도와 경도를 직접 입력받습니다 (설계 F1 수동 입력).
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function POST() {
  return NextResponse.json(
    {
      code: 'E_GEOCODE_NOT_CONFIGURED',
      message: '주소 변환 업체가 아직 정해지지 않았습니다. 위도와 경도를 직접 입력하세요.',
    },
    { status: 501 },
  )
}
