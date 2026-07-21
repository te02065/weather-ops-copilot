'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { STORES } from '@/lib/stores'
import type { StoreAnalytics } from '@/lib/analytics'

const STORE_COLORS: Record<string, string> = {
  gangnam:  '#3b82f6',
  hongdae:  '#f97316',
  pangyo:   '#10b981',
  haeundae: '#8b5cf6',
  jeju:     '#ef4444',
}

interface Props {
  analytics: StoreAnalytics[]
  selectedId: string
  onSelect: (id: string) => void
}

export default function StoreMap({ analytics, selectedId, onSelect }: Props) {
  const aMap = new Map(analytics.map((a) => [a.storeId, a]))

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={[36.4, 127.8]}
        zoom={7}
        style={{ height: 380, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {STORES.map((store) => {
          const a    = aMap.get(store.id)
          const sel  = store.id === selectedId
          const col  = STORE_COLORS[store.id] ?? '#64748b'
          return (
            <CircleMarker
              key={store.id}
              center={[store.lat, store.lon]}
              radius={sel ? 16 : 11}
              pathOptions={{
                fillColor: col,
                fillOpacity: sel ? 1 : 0.7,
                color: '#fff',
                weight: 2.5,
              }}
              eventHandlers={{ click: () => onSelect(store.id) }}
            >
              <Popup>
                <div className="text-sm space-y-1 min-w-[140px]">
                  <p className="font-bold">{store.name}</p>
                  {a && (
                    <>
                      <p className="text-slate-600">일평균 ₩{a.summary.avgDailySales.toLocaleString()}</p>
                      <p className="text-red-600 text-xs">강수×매출 r = {a.correlations.salesVsPrecip}</p>
                      <p className="text-blue-600 text-xs">아이스×기온 r = {a.correlations.iceRatioVsTemp}</p>
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
