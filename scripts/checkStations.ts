/**
 * 이 파일이 하는 일: weather/reference의 지점정보 CSV(ASOS, AWS)를 검사하고 결과를 보여 줍니다.
 * 입력: weather/reference/asos_stations.csv, weather/reference/aws_stations.csv
 * 출력: 콘솔 요약 (행 수, 운영 지점 수, 강우계 기록 수, 문제 목록). 파일은 고치지 않습니다.
 * 사용 예: npm run check-stations
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { checkStationCsv, type StationKind } from '../weather/stationCheck'

const FILES: Array<[StationKind, string]> = [
  ['ASOS', join('weather', 'reference', 'asos_stations.csv')],
  ['AWS', join('weather', 'reference', 'aws_stations.csv')],
]

for (const [kind, file] of FILES) {
  const r = checkStationCsv(readFileSync(file, 'utf-8'), kind)
  console.log(`== ${kind} (${file})`)
  console.log(`  행 ${r.totalRows}개 · 운영 중 지점 ${r.activeIds}개 (운영 중 행 ${r.activeRows}개) · 강우계 기록 ${r.activeWithRainGauge}개`)
  if (r.issues.length === 0) {
    console.log('  ✔ 문제 없음')
  } else {
    console.log(`  ✖ 문제 ${r.issues.length}건`)
    for (const issue of r.issues.slice(0, 20)) console.log(`    - ${issue}`)
    if (r.issues.length > 20) console.log(`    ... 외 ${r.issues.length - 20}건`)
  }
}
