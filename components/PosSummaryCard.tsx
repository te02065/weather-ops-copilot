'use client'

import type { PosReport } from '@/analysis/posReport'
import { CATEGORY_NAME_OF_BELL, categoryLabel } from './posLabels'

const won = (x: number) => `${Math.round(x).toLocaleString('ko-KR')}원`

/**
 * POS 리포트 요약: 기간, 대조 결과, 옵션 연결, 제외 줄, POS 카테고리별 합계.
 * 입력: PosReport
 * 출력: 항목별 한 줄 설명과 표
 * 주의점: 대조에서 맞지 않은 날은 "무시한 차이"로 표시합니다 (원인을 모르는 금액은 분석에서 뺍니다).
 */
export default function PosSummaryCard({ report }: { report: PosReport }) {
  const byCat = new Map<string, number>()
  for (const m of report.menuDaily) byCat.set(m.posCategory, (byCat.get(m.posCategory) ?? 0) + m.amount)
  const excluded = report.excluded
    .filter((e) => e.kind !== 'option')  // 옵션은 매출에 포함합니다
    .map((e) => `${CATEGORY_NAME_OF_BELL[e.kind] ?? e.kind} ${e.rows}건 (${won(e.amount)})`)
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">POS 리포트 확인</h3>
      <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
        <li>기록 기간: {report.period?.start} ~ {report.period?.end} ({report.daily.length}일)</li>
        <li>매출 확인: {report.reconcile.matchedDays}일은 결제 금액과 메뉴 금액이 맞았어요</li>
        {report.reconcile.ignoredDays > 0 && (
          <li>맞지 않은 {report.reconcile.ignoredDays}일 ({won(report.reconcile.ignoredGap)})은 원인을 알 수 없어서 빼고 봤어요</li>
        )}
        <li>추가 선택(옵션) 금액 {won(report.options.attached.amount + report.options.unlinked.amount)}은 매출에 포함했어요. 한 메뉴에 붙은 {won(report.options.attached.amount)}은 그 메뉴에 넣었고, 어느 메뉴인지 알 수 없는 {won(report.options.unlinked.amount)}은 따로 넣었어요</li>
        <li>분류 이름이 비어 있던 메뉴 {report.categoryFilled}건은 같은 이름 메뉴의 분류로 채웠어요</li>
        <li>빼고 본 것: {excluded.length > 0 ? excluded.join(', ') : '없음'}</li>
      </ul>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).map(([name, amt]) => (
          <div key={name} className="rounded-lg bg-slate-50 p-2">
            <div className="text-xs text-slate-500">{categoryLabel(name)}</div>
            <div className="font-semibold">{won(amt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
