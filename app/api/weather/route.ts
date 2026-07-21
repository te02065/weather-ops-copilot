import { NextResponse } from 'next/server'
import { getAllStoresWeather, getStoreWeather } from '@/lib/weather'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (storeId) {
      const data = await getStoreWeather(storeId)
      return NextResponse.json(data)
    }

    const data = await getAllStoresWeather()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
