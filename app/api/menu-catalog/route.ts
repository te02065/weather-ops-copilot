/**
 * GET /api/menu-catalog?storeId=CAFE-A  → 매장 메뉴표를 돌려줍니다.
 * PUT /api/menu-catalog  body: { storeId, changes: { "메뉴 이름": "카테고리" } } → 고친 분류를 합쳐 저장합니다.
 * 주의점: 메뉴 이름은 data/menu_catalog에만 저장합니다 (git 제외). 응답에는 저장 폴더 경로를 넣지 않습니다.
 *         잘못된 카테고리나 긴 이름은 400으로 돌려보냅니다.
 */

import { NextResponse } from 'next/server'
import { mergeCatalog } from '@/analysis/menuCatalog'
import { CATALOG_DIR, isValidStoreId, readCatalog, writeCatalog } from '@/menu/catalogFile'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get('storeId') ?? ''
  if (!isValidStoreId(storeId)) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '매장 번호 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const r = readCatalog(CATALOG_DIR, storeId)
  if (!r.ok) return NextResponse.json({ code: 'E_MENU_CATALOG', message: r.message }, { status: 500 })
  return NextResponse.json({ catalog: r.catalog })
}

export async function PUT(request: Request) {
  let body: { storeId?: unknown; changes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const storeId = typeof body.storeId === 'string' ? body.storeId : ''
  if (!isValidStoreId(storeId) || typeof body.changes !== 'object' || body.changes === null || Array.isArray(body.changes)) {
    return NextResponse.json({ code: 'E_BAD_REQUEST', message: '매장 번호와 바꿀 분류를 확인하세요.' }, { status: 400 })
  }
  const current = readCatalog(CATALOG_DIR, storeId)
  if (!current.ok) return NextResponse.json({ code: 'E_MENU_CATALOG', message: current.message }, { status: 500 })
  const merged = mergeCatalog(current.catalog, body.changes as Record<string, string>)
  if (!merged.ok) return NextResponse.json({ code: 'E_BAD_REQUEST', message: merged.message }, { status: 400 })
  const saved = writeCatalog(CATALOG_DIR, merged.catalog)
  if (!saved.ok) return NextResponse.json({ code: 'E_MENU_CATALOG', message: saved.message }, { status: 500 })
  return NextResponse.json({ catalog: merged.catalog })
}
