/**
 * 이 파일이 하는 일: AWS 매분자료를 하루치 받아, 강수 값이 실제로 찍히는지 확인합니다. (개발자가 손으로 실행)
 * 입력: --stn <AWS 지점번호> --date <YYYY-MM-DD>
 * 출력: 콘솔 요약 (분 단위 개수, 강수 감지, 하루 강수량, 같은 날 ASOS 캐시 값과 비교), 원문 저장
 * 주의점: 실제 기상청 호출은 이 명령을 직접 실행할 때만 일어납니다. 키 값은 출력하지 않습니다.
 *         지점 108로 실행하면 같은 지점의 ASOS(캐시)와 바로 비교할 수 있습니다.
 * 사용 예: npm run aws-probe -- --stn 108 --date 2026-10-18
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fetchAwsMinuteDay } from '../weather/awsClient'
import { awsDailyPrecip, awsDayCoverage, parseAwsMinute } from '../weather/awsMinute'
import { readKmaKey } from '../weather/kmaKey'
import { cacheFilePath } from '../weather/cache'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local')
  const stn = arg('--stn')
  const date = arg('--date')
  if (!stn || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.log('사용법: npm run aws-probe -- --stn <지점번호> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const key = readKmaKey(process.env)
  if (!key.ok) {
    console.log(`✖ ${key.error.message}`)
    process.exit(1)
  }

  const res = await fetchAwsMinuteDay(stn, date, key.key)
  if (!res.ok) {
    console.log(`✖ [${res.error.code}] ${res.error.message}`)
    console.log(`  → ${res.error.hint}`)
    process.exit(1)
  }
  const rawDir = join('data', 'weather_cache', 'raw')
  mkdirSync(rawDir, { recursive: true })
  const rawPath = join(rawDir, `aws-${stn}-${date}.txt`)
  writeFileSync(rawPath, res.text, 'utf-8')

  const parsed = parseAwsMinute(res.text)
  if (!parsed.ok) {
    console.log(`✖ [${parsed.error.code}] ${parsed.error.message}`)
    console.log(`  원문: ${rawPath}`)
    process.exit(1)
  }
  const rows = parsed.rows
  const cov = awsDayCoverage(rows, date)
  const daily = awsDailyPrecip(rows, date)
  console.log(`✔ AWS ${stn} ${date}: 분 자료 ${cov.minutes}개 (하루 1,440분${cov.minutes < 1440 ? ' 중 부족 — 자료가 끊긴 시간이 있음' : ''})`)
  console.log(`  강수 감지(RE=1) 분 수: ${cov.rainDetected}`)
  if (daily === null) {
    console.log('  하루 강수량: 결측')
  } else if (daily === 0 && cov.rainDetected > 0) {
    console.log('  하루 강수량: 0mm — 비는 감지했지만 강수량은 기록되지 않음 (이 지점은 강수량을 재지 않을 가능성)')
  } else {
    console.log(`  하루 강수량(RN-DAY 최댓값): ${daily}mm`)
  }
  compareWithAsos(stn, date, daily)
  console.log(`  원문: ${rawPath}`)
}

/** 같은 지점이 ASOS 캐시에 있으면 같은 날 값을 나란히 보여 줍니다. */
function compareWithAsos(stn: string, date: string, aws: number | null): void {
  const path = cacheFilePath(stn)
  if (!existsSync(path)) {
    console.log('  비교: ASOS 캐시가 없어 비교하지 않습니다.')
    return
  }
  const cache = JSON.parse(readFileSync(path, 'utf-8')) as { days: Record<string, { precipMm: number | null }> }
  const asos = cache.days[date]?.precipMm
  console.log(`  비교: ASOS 같은 날 ${asos === undefined ? '자료 없음' : `${asos}mm`} / AWS ${aws === null ? '결측' : `${aws}mm`}`)
}

main().catch(() => {
  console.log('✖ 예상하지 못한 오류 (키는 출력하지 않습니다)')
  process.exit(1)
})
