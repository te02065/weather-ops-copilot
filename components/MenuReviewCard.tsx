'use client'

import { CATEGORIES, type Category } from '@/analysis/menuCategory'
import type { SuggestedMenu } from '@/analysis/menuCatalog'

/**
 * 메뉴 분류 확인 카드: 업로드 파일에서 찾은 메뉴마다 카테고리를 보여 주고 고치게 합니다.
 * 입력: 추천 목록(메뉴 이름, 추천 카테고리, 출처), 지금 고른 분류, 바꿀 때 실행할 함수
 * 출력: 메뉴별 드롭다운과 "저장된 분류" 또는 "자동 추천" 표시
 * 주의점: 메뉴가 없으면 아무것도 그리지 않습니다. 고친 분류는 확인 버튼을 누를 때 메뉴표에 저장됩니다.
 */
export default function MenuReviewCard({
  suggestions,
  chosen,
  onChange,
}: {
  suggestions: SuggestedMenu[]
  chosen: Record<string, Category>
  onChange: (name: string, category: Category) => void
}) {
  if (suggestions.length === 0) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <h3 className="text-h2 text-slate-700">메뉴 분류 확인</h3>
      <p className="text-sm text-slate-600">
        파일에서 메뉴 {suggestions.length}개를 찾았어요. 카테고리가 맞는지 확인하고, 틀리면 바꿔 주세요.
      </p>
      <ul className="divide-y divide-slate-100">
        {suggestions.map((m) => (
          <li key={m.name} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_200px] gap-2 items-center text-sm">
            <span className="font-medium text-slate-800 break-words">{m.name}</span>
            <span className={`text-xs rounded px-2 py-0.5 w-fit ${m.source === 'catalog' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {m.source === 'catalog' ? '저장된 분류' : '자동 추천'}
            </span>
            <select
              className="border border-slate-300 rounded-lg px-2 py-1"
              value={chosen[m.name] ?? m.category}
              onChange={(e) => onChange(m.name, e.target.value as Category)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
