/**
 * 이 파일이 하는 일: CSV 한 개로 전체 분석을 실행합니다. 검증 → 날씨 연결 → 특징 → 백테스트 → 판정 → 목표일 예측 → 저장.
 * 입력: CSV 파일 경로, 열 매핑 옵션 (--date, --sales 필수 / --transactions, --ice, --hot 선택)
 *       --store <익명 코드> (기본 CAFE-A), --weather-file <날씨 CSV> (없으면 기상청 캐시 사용), --synthetic (합성 데이터 표시), --debug
 * 출력: 콘솔 요약 (✔/✖, 집계 숫자만), data/reports/<코드>-<기준일>.json, data/snapshots/<코드>-<목표일>.json, 실행 로그
 * 주의점: 매출 금액과 날짜별 목록은 콘솔에도 저장 파일에도 쓰지 않습니다. 상호명은 쓰지 않고 익명 코드만 씁니다.
 *         기상청 캐시를 쓰려면 먼저 npm run kma 로 자료를 받아 두어야 합니다. 없으면 안내 후 종료합니다.
 * 사용 예: npm run analyze -- tests/fixtures/synthetic/synthetic_pipeline_sales_400d.csv --date date --sales sales --synthetic --weather-file tests/fixtures/synthetic/synthetic_pipeline_weather_400d.csv
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { ingestSalesCsvBytes } from '../analysis/ingest'
import { configureLogger, log } from '../analysis/logger'
import { runPipeline, type PipelineResult } from '../analysis/pipeline'
import { parseWeatherCsv } from '../analysis/weatherInput'
import { verdictSentence } from '../analysis/verdict'
import type { ColumnMapping, IngestResult, DailyWeather } from '../analysis/types'
import { cacheFilePath, cacheToDaily, readCache } from '../weather/cache'
import { loadStationList } from '../weather/station'
import { createFileLogSink, sha256Of } from './fileLogSink'
import { parseArgs } from './parseArgs'

function printUsage(): void {
  console.log('사용법: npm run analyze -- <CSV 파일> --date <날짜 열> --sales <매출 열> [--transactions <열>] [--ice <열>] [--hot <열>]')
  console.log('        [--store <익명 코드>] [--weather-file <날씨 CSV>] [--synthetic] [--debug]')
  console.log('예시:   npm run analyze -- tests/fixtures/synthetic/synthetic_pipeline_sales_400d.csv --date date --sales sales --synthetic --weather-file tests/fixtures/synthetic/synthetic_pipeline_weather_400d.csv')
  console.log('※ 열 이름은 파일 헤더와 똑같이 적어야 합니다. 자동으로 찾지 않습니다.')
}

function printIngest(result: IngestResult, totalMs: number, debug: boolean): void {
  const parseErrors = result.errors.filter((e) => e.stage === 'ingest.parse')
  const validateErrors = result.errors.filter((e) => e.stage === 'ingest.validate')
  if (parseErrors.length > 0) {
    console.log(`✖ ingest.parse 실패: ${parseErrors[0]!.message}`)
    console.log(`  → ${parseErrors[0]!.hint}`)
    return
  }
  console.log(`✔ ingest.parse ${result.summary.rowCount}행`)
  if (validateErrors.length > 0) {
    console.log(`✖ ingest.validate 실패 (오류 ${validateErrors.length}건) · ${totalMs}ms`)
    for (const e of validateErrors) {
      console.log(`  [${e.code}] ${e.message}`)
      console.log(`     → ${e.hint}`)
    }
  } else {
    console.log(`✔ ingest.validate ${result.summary.rowCount}행 · ${totalMs}ms`)
  }
  const encoding = result.warnings.find((w) => w.code === 'I_ENCODING')
  if (encoding) console.log(`  인코딩: ${encoding.message}`)
  const rest = result.warnings.filter((w) => w.code !== 'I_ENCODING')
  if (rest.length > 0) {
    const counts = new Map<string, number>()
    for (const w of rest) counts.set(w.code, (counts.get(w.code) ?? 0) + 1)
    console.log(`  경고: ${Array.from(counts.entries()).map(([c, n]) => `${c} ${n}건`).join(', ')}`)
    if (debug) for (const w of rest) console.log(`    [${w.code}] ${w.message}`)
  }
  const s = result.summary
  if (s.dateStart !== null) console.log(`  기간: ${s.dateStart} ~ ${s.dateEnd} · 유효 영업일 ${s.validDays}일 · 휴무 후보 ${s.zeroDays}일`)
}

/** 날씨 자료를 읽습니다: 파일이 주어지면 그 파일, 아니면 기상청 캐시. */
function loadWeather(weatherFile: string | undefined): { ok: true; rows: DailyWeather[]; source: string } | { ok: false; message: string } {
  if (weatherFile) {
    const parsed = parseWeatherCsv(readFileSync(resolve(weatherFile), 'utf-8'))
    if (parsed.errors.length > 0) return { ok: false, message: `날씨 파일 오류: ${parsed.errors[0]!.message}` }
    return { ok: true, rows: parsed.rows, source: '날씨 파일' }
  }
  const stations = loadStationList()
  const stationId = stations.stations[0]?.id
  if (!stations.confirmed || !stationId) {
    return { ok: false, message: '관측소가 확정되지 않았습니다. data/weather_cache/stations.json을 확인하세요.' }
  }
  const path = cacheFilePath(stationId)
  if (!existsSync(path)) {
    return { ok: false, message: '날씨 자료가 없습니다. 먼저 npm run kma -- --stn <번호> --start <날짜> --end <날짜> 를 실행하세요.' }
  }
  return { ok: true, rows: cacheToDaily(readCache(path, stationId)), source: `기상청 캐시 (관측소 ${stationId})` }
}

function printResult(r: Extract<PipelineResult, { ok: true }>): void {
  const rep = r.report
  console.log(`✔ 모델 M1 ${r.model.version} · 학습 ${r.trainDays}일 · 날씨 결측 ${(r.weatherMissingRatio * 100).toFixed(1)}%`)
  if (r.model.dropped.length > 0) console.log(`  빠진 항: ${r.model.dropped.join(', ')} (표본 부족 또는 같은 정보)`)
  const h = rep.holdout
  console.log(`  holdout(최근 ${h.n}일): MAE ${fmt(h.mae)}원 · WAPE ${fmtPct(h.wape)} · 방향 정확도 ${fmtPct(h.directionAcc)}`)
  const c = rep.comparison
  if (c.verdict) {
    console.log(`  기준선 A 대비 ΔMAE ${fmt(c.deltaMae)}원, 95% 구간 [${fmt(c.lower)}, ${fmt(c.upper)}] (n=${c.n})`)
    console.log(`  판정: ${c.verdict} — ${verdictSentence(c.verdict)}`)
  }
  const p = r.prediction
  console.log(`✔ 목표일 ${p.targetDate}: ${p.statusText || '예측 가능'}`)
  if (p.expectedSales !== null) console.log(`  예상 매출 ${fmt(p.expectedSales)}원 (기준선 ${fmt(p.baselineSales)}원, ${fmt(p.changeRatePct)}%)`)
  else console.log(`  기준선 ${fmt(p.baselineSales)}원 (날씨 모델 값 없음)`)
  for (const rec of r.recommendations) console.log(`  참고 [${rec.evidence}, 표본 ${rec.sampleSize}]: ${rec.text}`)
}

function fmt(x: number | null): string {
  return x === null ? '-' : Math.round(x).toLocaleString('ko-KR')
}

function fmtPct(x: number | null): string {
  return x === null ? '-' : `${(x * 100).toFixed(1)}%`
}

function saveOutputs(r: Extract<PipelineResult, { ok: true }>, source: 'real' | 'synthetic'): { report: string; snapshot: string } {
  const reportDir = join(process.cwd(), 'data', 'reports')
  const snapDir = join(process.cwd(), 'data', 'snapshots')
  mkdirSync(reportDir, { recursive: true })
  mkdirSync(snapDir, { recursive: true })
  const reportPath = join(reportDir, `${r.storeCode}-${r.cutoff}.json`)
  const snapPath = join(snapDir, `${r.storeCode}-${r.prediction.targetDate}.json`)
  writeFileSync(reportPath, JSON.stringify({
    storeCode: r.storeCode, source, cutoff: r.cutoff, validDays: r.validDays, trainDays: r.trainDays,
    weatherMissingRatio: r.weatherMissingRatio, modelVersion: r.model.version, dropped: r.model.dropped,
    report: r.report,
  }, null, 2), 'utf-8')
  const p = r.prediction
  writeFileSync(snapPath, JSON.stringify({
    targetDate: p.targetDate, issuedAt: new Date().toISOString(), forecastIssuedAt: null, source,
    modelVersion: p.modelVersion, expectedSales: p.expectedSales, baselineSales: p.baselineSales,
    changeRatePct: p.changeRatePct, status: p.status, factors: p.factors, sourceNote: p.sourceNote,
  }, null, 2), 'utf-8')
  return { report: reportPath, snapshot: snapPath }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const mapping = options.mapping
  if (!options.filePath || !mapping.date || !mapping.sales) {
    printUsage()
    process.exit(1)
  }
  const bytes = readFileSync(resolve(options.filePath))
  const sink = createFileLogSink(process.cwd())
  configureLogger({ runId: sink.runId, sink: sink.sink })
  log('ingest.parse', 'start', { sha256: sha256Of(bytes) })

  const startedAt = Date.now()
  const ingest = ingestSalesCsvBytes(bytes, mapping as ColumnMapping)
  printIngest(ingest, Date.now() - startedAt, options.debug)
  if (!ingest.ok) {
    console.log(`로그 파일: ${sink.filePath}`)
    process.exit(1)
  }

  const weather = loadWeather(options.weatherFile)
  if (!weather.ok) {
    console.log(`✖ weather.join: ${weather.message}`)
    process.exit(1)
  }
  console.log(`✔ 날씨 연결: ${weather.source} ${weather.rows.length}일`)

  const storeCode = options.store ?? 'CAFE-A'
  const result = runPipeline({ storeCode, sales: ingest.rows, weather: weather.rows, events: [] })
  if (!result.ok) {
    console.log(`✖ features.build: 유효 영업일 ${result.validDays}일 (최소 ${result.minDays}일 필요)`)
    console.log('  → 데이터가 부족해 예측을 만들지 않았습니다.')
    console.log(`로그 파일: ${sink.filePath}`)
    process.exit(1)
  }
  printResult(result)
  const saved = saveOutputs(result, options.synthetic ? 'synthetic' : 'real')
  console.log(`리포트: ${saved.report}`)
  console.log(`스냅샷: ${saved.snapshot}`)
  console.log(`로그 파일: ${sink.filePath}`)
  process.exit(0)
}

main()
