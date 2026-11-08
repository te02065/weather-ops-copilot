'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

export interface MapPoint {
  id: string
  name: string
  lat: number
  lon: number
}

interface Props {
  points: MapPoint[]
  selectedId: string
  onSelect: (id: string) => void
}

/** 매장 위치 지도. 좌표는 data/stores.json에서 받습니다. 기본 중심은 대한민국 중부입니다. */
export default function StoreMap({ points, selectedId, onSelect }: Props) {
  const center = points[0] ? [points[0].lat, points[0].lon] as [number, number] : [36.4, 127.8] as [number, number]
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer center={center} zoom={points.length ? 12 : 7} style={{ height: 380, width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => {
          const sel = p.id === selectedId
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={sel ? 16 : 11}
              pathOptions={{ fillColor: '#3b82f6', fillOpacity: sel ? 1 : 0.7, color: '#fff', weight: 2.5 }}
              eventHandlers={{ click: () => onSelect(p.id) }}
            >
              <Popup>
                <div className="text-sm"><p className="font-bold">{p.name}</p></div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
