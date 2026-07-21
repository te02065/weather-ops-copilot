import type { Correlations } from '@/lib/analytics'

function Badge({ label, r, description }: { label: string; r: number; description: string }) {
  const abs      = Math.abs(r)
  const positive = r >= 0
  const strength = abs >= 0.7 ? '강함' : abs >= 0.4 ? '보통' : '약함'

  const bg      = positive ? 'bg-blue-50  border-blue-200'  : 'bg-red-50  border-red-200'
  const textCol = positive ? 'text-blue-900'                 : 'text-red-900'
  const barCol  = positive ? 'bg-blue-500'                   : 'bg-red-500'
  const sign    = positive ? '+' : ''

  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-semibold opacity-60 uppercase tracking-wide ${textCol}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textCol}`}>{sign}{r.toFixed(3)}</p>
      <p className={`text-xs mt-0.5 opacity-50 ${textCol}`}>{strength} {positive ? '양' : '음'}의 상관</p>
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
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">피어슨 상관계수</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Badge
          label="매출 × 강수량"
          r={correlations.salesVsPrecip}
          description="비 오는 날 매출 감소"
        />
        <Badge
          label="아이스비율 × 기온"
          r={correlations.iceRatioVsTemp}
          description="더울수록 아이스 ↑"
        />
        <Badge
          label="매출 × 기온"
          r={correlations.salesVsTemp}
          description="장마 혼재 효과"
        />
        <Badge
          label="매출 × 체감온도"
          r={correlations.salesVsApparentTemp}
          description="체감온도 영향"
        />
      </div>
    </section>
  )
}
