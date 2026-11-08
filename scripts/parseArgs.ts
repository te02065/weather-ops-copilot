/**
 * 이 파일이 하는 일: 명령줄 옵션을 읽습니다. 예: npm run analyze -- 파일.csv --date 날짜 --sales 매출
 * 입력: 명령줄 인자 배열 (process.argv에서 앞의 두 개를 뺀 것)
 * 출력: 파일 경로, 열 매핑, 옵션 (--debug, --store, --weather-file, --synthetic)
 * 주의점: 열 이름을 추정하지 않습니다. --date와 --sales가 없으면 실행하는 쪽에서 안내합니다.
 */

import type { ColumnMapping } from '../analysis/types'

export interface CliOptions {
  filePath?: string
  mapping: Partial<ColumnMapping>
  debug: boolean
  store?: string
  weatherFile?: string
  synthetic: boolean
}

/** 옵션 이름 → 매핑 키. 예: --ice 열 이름은 iceSales에 들어갑니다. */
const COLUMN_FLAGS: Record<string, keyof ColumnMapping> = {
  '--date': 'date',
  '--sales': 'sales',
  '--transactions': 'transactions',
  '--ice': 'iceSales',
  '--hot': 'hotSales',
}

/** 값을 받는 옵션 (다음 칸이 값입니다). */
const VALUE_FLAGS: Record<string, 'store' | 'weatherFile'> = {
  '--store': 'store',
  '--weather-file': 'weatherFile',
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { mapping: {}, debug: false, synthetic: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--debug') {
      options.debug = true
    } else if (arg === '--synthetic') {
      options.synthetic = true
    } else if (COLUMN_FLAGS[arg] !== undefined) {
      options.mapping[COLUMN_FLAGS[arg]] = argv[i + 1] ?? ''
      i++ // 다음 칸은 값이므로 건너뜁니다
    } else if (VALUE_FLAGS[arg] !== undefined) {
      options[VALUE_FLAGS[arg]] = argv[i + 1]
      i++
    } else if (!arg.startsWith('--') && options.filePath === undefined) {
      options.filePath = arg
    }
  }
  return options
}
