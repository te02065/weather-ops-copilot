'use client'

import { useRef } from 'react'

interface Props {
  onUpload: (csvText: string) => Promise<void>
  onSample: () => Promise<void>
  loading: boolean
  error: string | null
}

export default function UploadSection({ onUpload, onSample, loading, error }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onUpload(ev.target?.result as string)
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] gap-10">
      {/* Hero */}
      <div className="text-center space-y-3 max-w-lg">
        <div className="text-6xl">🌤️</div>
        <h2 className="text-3xl font-bold text-slate-900">Weather-Driven Ops Copilot</h2>
        <p className="text-slate-500 leading-relaxed">
          Upload your store sales CSV. The copilot combines it with real weather data
          to generate correlation insights and a 7-day operational briefing via GPT-5.6.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onSample}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all"
        >
          <span>🚀</span>
          <span>{loading ? 'Analyzing…' : 'Start with Sample Data'}</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-4 bg-white text-slate-700 rounded-xl font-semibold text-lg border-2 border-slate-300 hover:border-blue-400 active:scale-95 disabled:opacity-60 transition-all"
        >
          <span>📂</span>
          <span>Upload CSV File</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Column spec hint */}
      <div className="bg-slate-100 rounded-xl px-6 py-4 text-center max-w-xl">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">CSV Column Format</p>
        <code className="text-xs text-slate-600 break-all">
          date, store_id, store_name, lat, lon, total_sales, ice_sales, hot_sales, transactions
        </code>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading weather data & computing correlations…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-3 text-sm max-w-md">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
