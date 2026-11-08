'use client'

import { useState } from 'react'
import type { BriefingFacts } from '@/briefing/facts'

/** 브리핑 생성. 허용된 facts만 서버로 보냅니다. AI가 없거나 실패하면 계산 결과 문장이 나옵니다. */
export default function BriefingCard({ facts }: { facts: BriefingFacts }) {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [source, setSource] = useState<'llm' | 'template' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts }),
      })
      const data = (await res.json()) as { text?: string; source?: 'llm' | 'template'; message?: string }
      if (!res.ok || !data.text) throw new Error(data.message ?? `요청 실패 (${res.status})`)
      setText(data.text)
      setSource(data.source ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '브리핑을 만들지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-orange-100 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h2 text-slate-900">운영 브리핑</h3>
          <p className="text-xs text-slate-500 mt-0.5">계산 결과만 전달합니다. 숫자는 모두 위 계산에서 나온 값입니다.</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50"
        >
          {loading ? '만드는 중…' : '브리핑 만들기'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">⚠️ {error}</p>}
      {text && (
        <>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">{text}</div>
          <p className="text-xs text-slate-400">
            {source === 'llm' ? 'AI가 쓴 문장 (숫자 검사 통과)' : '계산 결과를 그대로 적은 문장 (AI 문장을 쓰지 않았거나 숫자 검사에 걸림)'}
          </p>
        </>
      )}
    </div>
  )
}
