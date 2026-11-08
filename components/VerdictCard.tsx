'use client'

import type { ValidationReport } from '@/analysis/validationReport'
import { plainWon, exactWon } from './plain'

const VERDICT_STYLE: Record<'adopt' | 'hold' | 'reject', string> = {
  adopt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hold: 'bg-amber-50 text-amber-700 border-amber-200',
  reject: 'bg-slate-50 text-slate-700 border-slate-300',
}
const VERDICT_LABEL: Record<'adopt' | 'hold' | 'reject', string> = { adopt: '검증 중', hold: '검증 중', reject: '검증 중' }
const VERDICT_ANSWER: Record<'adopt' | 'hold' | 'reject', string> = {
  adopt: '과거 기록으로 맞춰 본 결과, 아직 참고용이에요',
  hold: '과거 기록으로 맞춰 본 결과, 아직 참고용이에요',
  reject: '과거 기록으로 맞춰 본 결과, 아직 참고용이에요',
}

const pct = (x: number | null) => (x === null ? '-' : `${(x * 100).toFixed(1)}%`)

/**
 * 검증 결과 (초등학생 기준): 답을 먼저 쓰고, 이유는 짧은 목록으로 씁니다.
 * 입력: 검증 보고서 (holdout 지표, 기준선 A 대비 비교)
 * 출력: 판정 한 줄, 핵심 이유 3줄, 자세히 보기(직접 계산해 볼 수 있는 값)
 * 주의점: 자세히 보기는 접혀 있습니다. 숫자를 외우거나 계산하게 하려는 것이 아닙니다.
 */
export default function VerdictCard({ report }: { report: ValidationReport }) {
  const c = report.comparison
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h2 text-slate-700">날씨 계산 검증 중</h3>
        {c.verdict && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${VERDICT_STYLE[c.verdict]}`}>
            {VERDICT_LABEL[c.verdict]}
          </span>
        )}
      </div>
      {c.verdict && <p className="text-base font-semibold text-slate-800">{VERDICT_ANSWER[c.verdict]}</p>}
      <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
        {c.deltaMae !== null && (
          <li>단순 계산(같은 요일 평균)과 비교한 차이: {plainWon(c.deltaMae)} (과거 기록으로 맞춰 본 값이에요)</li>
        )}
        <li>맞춰 본 기간: 최근 {report.holdout.n}일</li>
        <li>맞춰 본 날: {c.n}일 (적으면 믿기 어려워요)</li>
      </ul>
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer text-slate-500">자세히 보기 (직접 계산해 볼 수 있는 값)</summary>
        <ul className="mt-2 space-y-2 text-xs">
          <li>
            <span className="font-semibold">평균 오차(MAE)</span>: 예측과 실제의 차이를 평균 낸 금액.
            {report.holdout.mae === null ? ' -' : ` ${exactWon(report.holdout.mae)}`}
          </li>
          <li>
            <span className="font-semibold">오차 비율(WAPE)</span>: 매출 100원당 틀린 금액. 전체 오차 ÷ 전체 매출.
            {` ${pct(report.holdout.wape)}`}
          </li>
          <li>
            <span className="font-semibold">방향 정확도</span>: 평소보다 많이 팔릴지 적게 팔릴지 맞힌 비율.
            {` ${pct(report.holdout.directionAcc)}`}
          </li>
          <li>
            <span className="font-semibold">보통 계산</span>: 같은 요일 직전 4번의 평균. 날씨를 보지 않은 가장 단순한 계산입니다.
          </li>
          <li>
            <span className="font-semibold">보통 계산과의 차이(ΔMAE)</span>: 날씨 예측 오차 − 기준선 오차. 음수면 날씨 예측이 더 정확합니다.
            {c.deltaMae === null ? ' -' : ` ${exactWon(c.deltaMae)}`}
          </li>
          <li>
            <span className="font-semibold">95% 범위</span>: 이 차이가 우연이 아닐 가능성이 높은 범위.
            {c.lower === null || c.upper === null ? ' -' : ` [${exactWon(c.lower)}, ${exactWon(c.upper)}]`}
          </li>
        </ul>
      </details>
    </div>
  )
}
