import type { Correlations } from '@/lib/analytics'

function Badge({ label, r, description }: { label: string; r: number; description: string }) {
  const abs      = Math.abs(r)
  const positive = r >= 0
  const strength = abs >= 0.7 ? 'Strong' : abs >= 0.4 ? 'Moderate' : 'Weak'

  const bg      = positive ? 'bg-blue-50  border-blue-200'  : 'bg-red-50  border-red-200'
  const textCol = positive ? 'text-blue-900'                 : 'text-red-900'
  const barCol  = positive ? 'bg-blue-500'                   : 'bg-red-500'
  const sign    = positive ? '+' : ''

  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-semibold opacity-60 uppercase tracking-wide ${textCol}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textCol}`}>{sign}{r.toFixed(3)}</p>
      <p className={`text-xs mt-0.5 opacity-50 ${textCol}`}>{strength} {positive ? 'positive' : 'negative'} correlation</p>
      <div className="mt-3 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barCol}`} style={{ width: `${abs * 100}%` }} />
      </div>
      <p className={`text-xs mt-2 opacity-50 ${textCol}`}>{description}</p>
    </div>
  )
}

export default function CorrelationBadges({ correlations }: { correlations: Correlations }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Pearson Correlation Coefficients</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Badge
          label="Sales × Precipitation"
          r={correlations.salesVsPrecip}
          description="Sales drop on rainy days"
        />
        <Badge
          label="Ice Ratio × Temperature"
          r={correlations.iceRatioVsTemp}
          description="Hotter → more iced drinks"
        />
        <Badge
          label="Sales × Temperature"
          r={correlations.salesVsTemp}
          description="Mixed monsoon effect"
        />
        <Badge
          label="Sales × Apparent Temp"
          r={correlations.salesVsApparentTemp}
          description="Apparent temperature effect"
        />
      </div>
    </section>
  )
}
