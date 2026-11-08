/**
 * GET /api/store
 * 이 파일이 하는 일: 매장 정보(익명 코드, 상호명, 좌표)와 가장 가까운 확정 관측소를 돌려줍니다.
 * 입력: 없음 (data/stores.json과 data/weather_cache/stations.json을 읽음)
 * 출력: { storeCode, storeName, location, station } 또는 오류
 * 주의점: 상호명은 이 화면에만 보입니다. AI 요청이나 로그에는 넣지 않습니다.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { loadStationList, nearestStation } from '@/weather/station'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface StoreFile {
  stores: Array<{ storeId: string; storeName: string; location: { lat: number; lon: number; source: string } }>
}

export function GET(request: Request) {
  const wanted = new URL(request.url).searchParams.get('storeId')
  const path = join(process.cwd(), 'data', 'stores.json')
  if (!existsSync(path)) {
    return NextResponse.json({ code: 'E_NO_STORE', message: 'data/stores.json에 매장 정보가 없습니다.' }, { status: 404 })
  }
  const stores = (JSON.parse(readFileSync(path, 'utf-8')) as StoreFile).stores
  const store = stores.find((s) => s.storeId === wanted) ?? stores[0]
  if (!store) return NextResponse.json({ code: 'E_NO_STORE', message: '매장 정보가 비어 있습니다.' }, { status: 404 })
  const near = nearestStation(store.location, loadStationList())
  return NextResponse.json({
    storeCode: store.storeId,
    storeName: store.storeName,
    location: store.location,
    station: near.status === 'ok'
      ? { id: near.station.id, name: near.station.name, distanceKm: near.distanceKm, warning: near.warning }
      : { id: null, note: near.note },
  })
}
