'use client'

import { useMemo, useState } from 'react'
import type { FeatureRow } from '@/analysis/types'
import { similarDays } from '@/analysis/similarDays'
import { CONFIG } from '@/analysis/config'
import { isValidDay } from '@/analysis/features'

const fmt = (x: number) => Math.round(x).toLocaleString('ko-KR')

/**
 * 비슷한 날 찾기: 고른 날과 요일·비 구간·기온이 비슷했던 과거 날의 평균 매출을 보여 줍니다.
 * 입력: 특징 행 목록, 기준일(cutoff). 기본 선택은 기준일 이전의 가장 최근 유효 영업일입니다.
 * 출력: 비슷한 날 목록, 평균, 표본 수. 표본이 적으면 평균 대신 안내를 보입니다.
 * 주의점: 예보 날씨가 아니라 과거 관측값으로 찾습니다. 예보 연결 전까지 이 점을 화면에 적습니다.
 */
export default function SimilarDaysCard({ rows, cutoff }: { rows: FeatureRow[]; cutoff: string }) {
  const options = useMemo(
    () => rows.filter((r) => r.date <= cutoff && isValidDay(r)).map((r) => r.date).sort().reverse(),
    [rows, cutoff],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? options[0] ?? null
  const result = date ? similarDays(rows, date, cutoff) : null

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h2 text-slate-700">비슷한 날 찾기</h3>
        <select
          className="text-sm border border-slate-300 rounded-lg px-2 py-1"
          value={date ?? ''}
          onChange={(e) => setPicked(e.target.value)}
        >
          {options.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-400">
        같은 요일이고 비 온 정도(비 없음·약한 비·강한 비)가 같았던 과거 날을 찾습니다. 과거 날씨 기준입니다.
      </p>
      {result?.target && (
        <p className="text-sm text-slate-700">
          선택한 날: {result.target.date} · 평균 기온 {result.target.tempAvg === null ? '-' : `${result.target.tempAvg.toFixed(1)}℃`}
        </p>
      )}
      {result === null || result.target === null || result.target.rainBand === null || result.target.tempAvg === null ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">이 날은 날씨 기록이 없어 비슷한 날을 찾을 수 없어요.</p>
      ) : result.count < CONFIG.minBandDays ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          비슷한 날이 {result.count}일뿐이라 평균을 보여 주지 않아요 (최소 {CONFIG.minBandDays}일 필요).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><div className="text-xs text-slate-400">비슷한 날의 평균 매출</div><div className="font-bold text-lg">₩{fmt(result.avgSales ?? 0)}</div></div>
            <div><div className="text-xs text-slate-400">비교한 날</div><div className="font-bold text-lg">{result.count}일</div></div>
          </div>
          <ul className="text-sm text-slate-700 divide-y divide-slate-100">
            {result.days.map((d) => (
              <li key={d.date} className="flex justify-between py-1">
                <span>{d.date}</span>
                <span className="text-slate-500">{d.tempAvg.toFixed(1)}℃ · ₩{fmt(d.sales)}</span>
              </li>
            ))}
          </ul>
          {result.count > result.days.length && (
            <p className="text-xs text-slate-400">최근 {result.days.length}일만 보여 줍니다. 평균은 {result.count}일 전체입니다.</p>
          )}
        </>
      )}
    </div>
  )
}
