'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DayInput, WeeklyText } from '@/analysis/weeklyBriefing'
import { weeklyText, manWonText, sameWeatherName } from '@/analysis/weeklyBriefing'
import { weatherView } from '@/analysis/forecastView'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const todayText = () => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 주간 브리핑 카드. 화면에는 날짜별 문장을 보여 주고, 인쇄할 때는 A4 한 장짜리 PDF 양식이 나옵니다.
 * 입력: 매장 이름, 기간, 기록 일수, 날짜별 입력(세 기준, 추이, 메뉴 표)
 * 출력: 화면 카드 + 인쇄 전용 A4 양식(document.body 바로 아래에 붙여 인쇄 때 이것만 남깁니다)
 * 주의점: 'PDF로 저장' 버튼은 브라우저 인쇄를 엽니다 (저장은 인쇄 창에서 PDF로).
 *         인쇄 양식은 화면의 다른 내용이 빈 페이지를 만들지 않도록 따로 붙입니다 (globals.css의 print-root 규칙).
 */
export default function WeeklyBriefingCard({ storeName, period, validDays, days }: { storeName: string; period: string; validDays: number; days: DayInput[] }) {
  const w = weeklyText(days)
  const printRoot = usePrintRoot()
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">WeDOC 주간 브리핑 · 시범</p>
            <h3 className="text-h2 text-slate-800">{storeName} · {period}</h3>
            <p className="text-xs text-slate-500">생성 {todayText()} · 본인용 · 분석 방법 v1.1.1</p>
          </div>
          <button type="button" className="no-print text-sm rounded-lg bg-slate-800 text-white px-3 py-2" onClick={() => window.print()}>
            PDF로 저장 (인쇄)
          </button>
        </div>

        <p className="text-sm text-slate-800 font-semibold">{w.summary}</p>

        <div className="space-y-4">
          {w.days.map((d) => (
            <div key={d.title} className="border-t border-slate-100 pt-3">
              <p className="font-semibold text-slate-800">{d.title}</p>
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-1 mt-1">
                {d.lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <LimitsAndFooter w={w} />
      </div>

      {printRoot && createPortal(<PrintSheet storeName={storeName} period={period} validDays={validDays} days={days} w={w} />, printRoot)}
    </>
  )
}

/** 인쇄 양식을 붙일 자리. 화면에서는 숨기고, 인쇄할 때만 보입니다. */
function usePrintRoot(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const root = document.createElement('div')
    root.className = 'print-root'
    document.body.appendChild(root)
    setEl(root)
    return () => { root.remove() }
  }, [])
  return el
}

function LimitsAndFooter({ w }: { w: WeeklyText }) {
  return (
    <>
      <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 space-y-1">
        <p className="font-semibold">이 브리핑의 한계</p>
        {w.limits.map((l) => <p key={l}>· {l}</p>)}
      </div>
      <p className="text-xs text-slate-500">데이터 처리: 매출 파일은 이 브라우저에서만 읽어요. 삭제를 원하면 담당자에게 알려 주세요.</p>
      <p className="text-sm text-slate-700">{w.footer}</p>
    </>
  )
}

/** A4 한 장 양식 (명세 §6): 요약, 7일 표, 메뉴 말 줄, 참고할 일, 한계, 하단. */
function PrintSheet({ storeName, period, validDays, days, w }: { storeName: string; period: string; validDays: number; days: DayInput[]; w: WeeklyText }) {
  return (
    <div className="print-sheet text-[10pt] text-slate-800 space-y-3">
      <div>
        <p className="text-xs text-slate-500">WeDOC 주간 브리핑 · 시범</p>
        <p className="text-base font-bold">{storeName} (본인용) · {period}</p>
        <p className="text-xs text-slate-500">기록 {validDays}일 · 생성 {todayText()} · 분석 방법 v1.1.1</p>
      </div>

      <p className="font-semibold">{w.summary}</p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-500 text-left">
            <th className="py-1">날짜</th><th>날씨 (예보)</th><th>요일 평균 매출</th><th>작년 같은 날</th><th>날씨별 평균 매출</th><th>예상</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ criteria: c, outlook: o }) => (
            <tr key={c.date} className="border-b border-slate-200 align-top">
              <td className="py-1">{Number(c.date.slice(5, 7))}/{Number(c.date.slice(8, 10))}({DOW[c.dow]})</td>
              <td><span className="block">{weatherView(c.forecast).icon} {weatherView(c.forecast).rain}</span><span className="block text-[9pt] text-slate-600">{[weatherView(c.forecast).sky, weatherView(c.forecast).temp].filter(Boolean).join(' · ')}</span></td>
              <td>{c.sameWeekday.avg === null ? '비교할 날 부족' : `${manWonText(c.sameWeekday.avg)} (${c.sameWeekday.n}일)`}</td>
              <td>{c.lastYear.sales === null ? '기록 없음' : `${manWonText(c.lastYear.sales)} (1일)`}</td>
              <td>
                <span className="block">{sameWeatherName(c)}</span>
                {c.weatherLabel !== '예보 없음' && (c.sameWeather.avg === null
                  ? <span className="block">비교할 날 부족</span>
                  : <span className="block">{c.sameWeather.range ? `${manWonText(c.sameWeather.range[0])} ~ ${manWonText(c.sameWeather.range[1]).replace('약 ', '')}` : manWonText(c.sameWeather.avg)} ({c.sameWeather.n}일)</span>)}
              </td>
              <td>{o && o.direction !== 'unknown' ? (o.direction === 'more' ? '많이 팔릴 가능성' : o.direction === 'less' ? '적게 팔릴 가능성' : '비슷할 가능성') : '추이 없음'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1">
        <p>날씨에 따라 많이 달라지는 메뉴: {w.menu.movers.length > 0 ? w.menu.movers.join(', ') : '뚜렷한 메뉴가 아직 없어요'}</p>
        {w.menu.steady && <p>날씨와 관계없이 비슷하게 팔리는 메뉴: {w.menu.steady}</p>}
      </div>

      <p>{w.tip}</p>

      <div className="text-[9pt] text-slate-600 bg-slate-50 rounded p-2 space-y-0.5">
        <p className="font-semibold">이 브리핑의 한계</p>
        {w.limits.map((l) => <p key={l}>· {l}</p>)}
      </div>
      <p className="text-[9pt] text-slate-500">데이터 처리: 매출 파일은 이 브라우저에서만 읽어요. 삭제를 원하면 담당자에게 알려 주세요.</p>
      <p>{w.footer}</p>
    </div>
  )
}
