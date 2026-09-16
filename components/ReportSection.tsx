'use client'

import { useState } from 'react'
import type { StoreAnalytics } from '@/lib/analytics'
import type { StoreWeather } from '@/lib/weather'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  analytics: StoreAnalytics
  weather: StoreWeather
}

function ReportCard({
  title,
  subtitle,
  color,
  endpoint,
  payload,
}: {
  title: string
  subtitle: string
  color: 'blue' | 'orange'
  endpoint: string
  payload: unknown
}) {
  const { lang, t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const btnCls = color === 'blue'
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-orange-500 hover:bg-orange-600'
  const borderCls = color === 'blue' ? 'border-blue-100' : 'border-orange-100'

  async function generate() {
    setLoading(true)
    setError(null)
    setContent(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(payload as object), lang }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json() as { content: string }
      setContent(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bg-white border ${borderCls} border rounded-xl p-5 shadow-sm space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h2 text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className={`shrink-0 px-4 py-2 ${btnCls} text-white text-action-l rounded-lg disabled:opacity-50 transition-colors`}
        >
          {loading ? t.generating : t.generate}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          {t.generatingHint}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">⚠️ {error}</p>
      )}

      {content && (
        <div className="bg-slate-50 rounded-lg p-4 text-body-l text-slate-700 whitespace-pre-wrap max-h-[480px] overflow-y-auto">
          {content}
        </div>
      )}

      {!content && !loading && !error && (
        <div className="bg-slate-50 rounded-lg p-6 text-sm text-slate-400 text-center">
          {t.clickGenerate}
        </div>
      )}
    </div>
  )
}

export default function ReportSection({ analytics, weather }: Props) {
  const { t } = useLanguage()
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t.reportSectionTitle}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportCard
          title={t.insightTitle}
          subtitle={t.insightSubtitle}
          color="blue"
          endpoint="/api/report/insight"
          payload={{ analytics }}
        />
        <ReportCard
          title={t.briefingTitle}
          subtitle={t.briefingSubtitle}
          color="orange"
          endpoint="/api/report/briefing"
          payload={{ analytics, forecast: weather.forecast }}
        />
      </div>
    </section>
  )
}
