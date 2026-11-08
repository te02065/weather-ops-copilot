/**
 * 이 파일이 하는 일: 기상청 ASOS 일자료를 직접 받아 캐시에 저장합니다. (개발자가 손으로 실행하는 명령)
 * 입력: --stn <관측소 번호> --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--save-raw] [--cache-dir <폴더>]
 * 출력: 콘솔 요약 (키 설정 여부, 받은 날짜 수, 빠진 날짜 수, stale 여부), data/weather_cache/ 캐시 파일
 * 주의점: 실제 기상청 호출은 이 명령을 직접 실행할 때만 일어납니다. 자동 테스트는 호출하지 않습니다.
 *         키 값은 출력하지 않습니다. --save-raw는 응답 원문을 data/weather_cache/raw/에 저장해 열 이름을 확인할 때 씁니다.
 *         관측소 번호는 지점정보 조회로 확인한 값을 직접 넣어야 합니다. 코드에는 번호가 없습니다.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { configureLogger, log } from '../analysis/logger'
import { createFileLogSink } from './fileLogSink'
import { fetchAsosText } from '../weather/kmaClient'
import { getObservedDaily } from '../weather/observed'
import { kmaKeyStatus, readKmaKey } from '../weather/kmaKey'
import { loadStationList } from '../weather/station'
import type { DateChunk } from '../weather/asos'

interface Options {
  stn?: string
  start?: string
  end?: string
  saveRaw: boolean
  cacheDir?: string
}

function parseOptions(argv: string[]): Options {
  const opts: Options = { saveRaw: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--save-raw') opts.saveRaw = true
    else if (a === '--stn') opts.stn = argv[++i]
    else if (a === '--start') opts.start = argv[++i]
    else if (a === '--end') opts.end = argv[++i]
    else if (a === '--cache-dir') opts.cacheDir = argv[++i]
  }
  return opts
}

async function main(): Promise<void> {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local') // 서버 키는 여기서만 읽습니다
  const opts = parseOptions(process.argv.slice(2))
  if (!opts.stn || !opts.start || !opts.end) {
    console.log('사용법: npm run kma -- --stn <관측소번호> --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--save-raw]')
    process.exit(1)
  }

  console.log(kmaKeyStatus())
  const key = readKmaKey(process.env)
  if (!key.ok) {
    console.log(`✖ ${key.error.message}`)
    console.log(`  → ${key.error.hint}`)
    process.exit(1)
  }

  const stations = loadStationList()
  if (!stations.confirmed) {
    console.log('[확인 필요] 관측소 목록이 확정되지 않았습니다 (data/weather_cache/stations.json). 입력한 번호를 그대로 씁니다.')
  }

  const sink = createFileLogSink(process.cwd())
  configureLogger({ runId: sink.runId, sink: sink.sink })
  const rawDir = join(opts.cacheDir ?? join('data', 'weather_cache'), 'raw')

  const result = await getObservedDaily({
    stationId: opts.stn,
    start: opts.start,
    end: opts.end,
    cacheDir: opts.cacheDir,
    fetchChunk: async (chunk: DateChunk) => {
      const r = await fetchAsosText({ stationId: opts.stn!, start: chunk.start, end: chunk.end }, key.key)
      if (r.ok && opts.saveRaw) {
        mkdirSync(rawDir, { recursive: true })
        writeFileSync(join(rawDir, `asos-${opts.stn}-${chunk.start}-${chunk.end}.txt`), r.text, 'utf-8')
      }
      return r
    },
  })

  if (!result.ok) {
    console.log(`✖ weather.fetch 실패 [${result.error.code}]: ${result.error.message}`)
    console.log(`  → ${result.error.hint}`)
    console.log(`로그 파일: ${sink.filePath}`)
    process.exit(1)
  }
  console.log(`✔ weather.fetch 관측 ${result.days.length}일 · 캐시에 없는 날 ${result.missing.length}일 · stale ${result.stale ? '예' : '아니오'}`)
  if (result.error) console.log(`  경고: ${result.error.message} (캐시 값을 stale 표시로 사용)`)
  log('weather.fetch', 'end', { outCount: result.days.length })
  console.log(`로그 파일: ${sink.filePath}`)
  process.exit(0)
}

main().catch((err) => {
  // 오류 메시지에 키가 섞이지 않도록 키 자체는 출력하지 않습니다
  console.log(`✖ 예상하지 못한 오류: ${err instanceof Error ? err.name : 'Error'}`)
  process.exit(1)
})
