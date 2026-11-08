/**
 * 이 파일이 하는 일: 매출과 날씨 입력을 받아 특징, 모델, 백테스트, 판정, 목표일 예측, 참고 제안까지 한 번에 계산합니다.
 * 입력: 매출 행(검증 통과), 날씨 행, 달력 입력, 매장 익명 코드, 목표일(없으면 마지막 날 다음 날), 목표일 예보(없으면 null)
 * 출력: PipelineResult (특징 수, 검증 리포트, 목표일 예측, 참고 제안, 모델 정보)
 * 주의점: 순수 계산입니다. 파일을 읽거나 쓰지 않습니다. 파일 입출력은 scripts/runAnalysis.ts가 맡습니다.
 *         표본이 최소 기준(56 유효 영업일)보다 적으면 리포트를 만들지 않고 insufficient로 돌려줍니다 (방법론 G1).
 *         목표일 예보가 없으면 기준선만 냅니다 (forecast_unavailable).
 */

import { CONFIG } from './config'
import { buildFeatures, isValidDay } from './features'
import { trainM1, trainingRows, type M1Model } from './regression'
import { runBacktest } from './backtest'
import { buildValidationReport } from './validationReport'
import { predictTarget, type Prediction } from './forecast'
import { recommend, type Recommendation } from './recommend'
import { addDaysIso } from './dates'
import type { CalendarEvent, DailyWeather, FeatureRow, SalesInputRow } from './types'
import type { ValidationReport } from './validationReport'

export interface PipelineInput {
  storeCode: string
  sales: SalesInputRow[]
  weather: DailyWeather[]
  events: CalendarEvent[]
  targetDate?: string
  targetForecast?: DailyWeather | null // 목표일 예보. 없으면 null (예보 연결은 8단계 이후)
  cutoffOverride?: string              // 이 날짜 이전 기록만으로 학습 (과거 기간을 골라 예측할 때)
}

export type PipelineResult =
  | { ok: false; reason: 'insufficient_data'; validDays: number; minDays: number }
  | {
      ok: true
      storeCode: string
      cutoff: string
      targetDate: string
      validDays: number
      trainDays: number
      weatherMissingRatio: number
      model: M1Model
      report: ValidationReport
      prediction: Prediction
      recommendations: Recommendation[]
      features: FeatureRow[]
    }

export function runPipeline(input: PipelineInput): PipelineResult {
  const cutoff = input.cutoffOverride ?? (input.sales.map((s) => s.date).sort().at(-1) ?? '')
  const features = buildFeatures({ sales: input.sales, weather: input.weather, events: input.events }, cutoff)
  const validDays = features.filter(isValidDay).length
  if (validDays < CONFIG.minTrainDays) {
    return { ok: false, reason: 'insufficient_data', validDays, minDays: CONFIG.minTrainDays }
  }
  const model = trainM1(features, cutoff)
  const targetDate = input.targetDate ?? addDaysIso(cutoff, 1)
  const prediction = predictTarget(features, model, cutoff, {
    date: targetDate,
    weather: input.targetForecast ?? null,
    events: input.events,
  })
  const report = buildValidationReport(runBacktest(features))
  return {
    ok: true,
    storeCode: input.storeCode,
    cutoff,
    targetDate,
    validDays,
    trainDays: trainingRows(features, cutoff).length,
    weatherMissingRatio: missingRatio(features),
    model,
    report,
    prediction,
    recommendations: recommend(prediction),
    features,
  }
}

function missingRatio(features: FeatureRow[]): number {
  const valid = features.filter(isValidDay)
  if (valid.length === 0) return 1
  return valid.filter((r) => r.rainBand === null).length / valid.length
}
