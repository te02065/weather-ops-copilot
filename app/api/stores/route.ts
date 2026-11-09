/**
 * GET /api/stores
 * 이 파일이 하는 일: 등록된 매장 목록(매장 코드와 이름)을 돌려줍니다. 화면의 매장 선택에 씁니다.
 * 입력: 없음 (data/stores.json을 읽음)
 * 출력: { stores: [{ storeCode, storeName }] }
 * 주의점: 주소와 좌표는 넣지 않습니다. 필요하면 /api/store?storeId=를 씁니다.
 */

import { existsSync, readFileSync } from 'fs'
import { NextResponse } from 'next/server'
import { configFilePath } from '@/lib/dataPaths'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  const path = configFilePath('stores.json')
  if (!existsSync(path)) return NextResponse.json({ stores: [] })
  const stores = (JSON.parse(readFileSync(path, 'utf-8')) as { stores: Array<{ storeId: string; storeName: string }> }).stores
  return NextResponse.json({ stores: stores.map((s) => ({ storeCode: s.storeId, storeName: s.storeName })) })
}
