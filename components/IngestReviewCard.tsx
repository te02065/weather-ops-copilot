'use client'

import type { StageError } from '@/analysis/errors'
import type { ColumnMapping, IngestSummary } from '@/analysis/types'
import { columnLabel } from './posLabels'

export interface IngestReview {
  mapping: ColumnMapping
  summary: IngestSummary
  warnings: StageError[]
}

/**
 * 업로드 결과 확인 카드 (사장님이 파일이 맞는지 스스로 볼 수 있게 합니다).
 * 입력: 고른 열, 요약 숫자, 경고 목록 (message와 hint만 씁니다)
 * 출력: 감지한 열, 날짜 범위, 휴무 후보, 빠진 날·이상치 안내, 쉬운 해결 방법
 * 주의점: 매출 금액은 보이지 않습니다. 날짜 범위와 개수만 보여 줍니다.
 */
export default function IngestReviewCard({ review }: { review: IngestReview }) {
  const { mapping, summary, warnings } = review
  const notes = warnings.filter((w) => w.code !== 'I_ENCODING')
  const hints = Array.from(new Set(notes.map((w) => w.hint)))
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">파일 확인 결과</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Item label="날짜 열" value={columnLabel(mapping.date)} />
        <Item label="매출 열" value={columnLabel(mapping.sales)} />
        <Item label="거래 수 열" value={mapping.transactions ? columnLabel(mapping.transactions) : '선택 안 함'} />
        <Item label="읽은 날짜 수" value={`${summary.rowCount}일`} />
        <Item label="날짜 범위" value={summary.dateStart && summary.dateEnd ? `${summary.dateStart} ~ ${summary.dateEnd}` : '없음'} />
        <Item label="영업일" value={`${summary.validDays}일`} />
        <Item label="매출 0원 (휴무 후보)" value={`${summary.zeroDays}일`} />
        <Item label="빈 매출 칸" value={`${summary.missingSalesCells}칸`} />
      </div>
      {notes.length > 0 && (
        <ul className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3 space-y-1 list-disc list-inside">
          {notes.map((w, i) => <li key={`${w.code}-${i}`}>{w.message}</li>)}
        </ul>
      )}
      {hints.length > 0 && (
        <div className="text-xs text-slate-600">
          <span className="font-semibold">이렇게 해 보세요: </span>
          {hints.join(' / ')}
        </div>
      )}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800 break-words">{value}</div>
    </div>
  )
}
