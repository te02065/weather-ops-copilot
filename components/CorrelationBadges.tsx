import type { Correlations } from '@/lib/analytics'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Dict } from '@/lib/i18n/dictionary'

function Badge({
  label, r, description, t,
}: {
  label: string
  r: number
  description: string
  t: Dict
}) {
  const abs      = Math.abs(r)
  const positive = r >= 0
  const strength = abs >= 0.7 ? t.strong : abs >= 0.4 ? t.moderate : t.weak

  const bg      = positive ? 'bg-blue-50  border-blue-200'  : 'bg-red-50  border-red-200'
  const textCol = positive ? 'text-blue-900'                 : 'text-red-900'
  const barCol  = positive ? 'bg-blue-500'                   : 'bg-red-500'
  const sign    = positive ? '+' : ''

  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-semibold opacity-60 uppercase tracking-wide ${textCol}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textCol}`}>{sign}{r.toFixed(3)}</p>
      <p className={`text-xs mt-0.5 opacity-50 ${textCol}`}>{strength} {positive ? t.positiveCorr : t.negativeCorr}</p>
      <div className="mt-3 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barCol}`} style={{ width: `${abs * 100}%` }} />
      </div>
      <p className={`text-xs mt-2 opacity-50 ${textCol}`}>{description}</p>
    </div>
  )
}

export default function CorrelationBadges({ correlations }: { correlations: Correlations }) {
  const { t } = useLanguage()
  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{t.pearsonTitle}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Badge
          label={t.badgeSalesPrecip}
          r={correlations.salesVsPrecip}
          description={t.badgeSalesPrecipDesc}
          t={t}
        />
        <Badge
          label={t.badgeIceTemp}
          r={correlations.iceRatioVsTemp}
          description={t.badgeIceTempDesc}
          t={t}
        />
        <Badge
          label={t.badgeSalesTemp}
          r={correlations.salesVsTemp}
          description={t.badgeSalesTempDesc}
          t={t}
        />
        <Badge
          label={t.badgeSalesApparent}
          r={correlations.salesVsApparentTemp}
          description={t.badgeSalesApparentDesc}
          t={t}
        />
      </div>
    </section>
  )
}
