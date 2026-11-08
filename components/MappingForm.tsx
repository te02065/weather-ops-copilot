'use client'

import { useState } from 'react'
import type { ColumnMapping } from '@/analysis/types'

interface Props {
  headers: string[]
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
}

const OPTIONAL = [
  { key: 'transactions', label: '거래 수 (선택)' },
  { key: 'iceSales', label: '아이스 매출 (선택)' },
  { key: 'hotSales', label: '핫 매출 (선택)' },
] as const

/** 열 매핑: 자동으로 고르지 않습니다. 사용자가 헤더에서 직접 고릅니다. */
export default function MappingForm({ headers, onConfirm, onCancel }: Props) {
  const [date, setDate] = useState('')
  const [sales, setSales] = useState('')
  const [optional, setOptional] = useState<Record<string, string>>({})
  const ready = date !== '' && sales !== ''

  function submit() {
    if (!ready) return
    const mapping: ColumnMapping = { date, sales }
    for (const o of OPTIONAL) {
      const v = optional[o.key]
      if (v) (mapping as unknown as Record<string, string>)[o.key] = v
    }
    onConfirm(mapping)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-xl mx-auto space-y-4">
      <h2 className="text-h2 text-slate-900">열 고르기</h2>
      <p className="text-xs text-slate-500">파일의 첫 줄(헤더)에 있는 열 이름을 직접 고르세요. 자동으로 고르지 않습니다.</p>
      <Select label="날짜 열 (필수)" value={date} onChange={setDate} headers={headers} />
      <Select label="매출 열 (필수)" value={sales} onChange={setSales} headers={headers} />
      {OPTIONAL.map((o) => (
        <Select
          key={o.key}
          label={o.label}
          value={optional[o.key] ?? ''}
          onChange={(v) => setOptional((prev) => ({ ...prev, [o.key]: v }))}
          headers={headers}
        />
      ))}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800">다른 파일</button>
        <button
          onClick={submit}
          disabled={!ready}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50"
        >
          분석 시작
        </button>
      </div>
    </div>
  )
}

function Select({ label, value, onChange, headers }: { label: string; value: string; onChange: (v: string) => void; headers: string[] }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      >
        <option value="">선택 안 함</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  )
}
