import 'server-only'
/**
 * 이 파일이 하는 일: 기상청 단기예보(VilageFcstInfoService_2.0 getVilageFcst)를 한 번 불러 목표일 하루 값을 만듭니다.
 * 입력: 목표일, 격자 번호(nx, ny), 발표 시각(base), 인증키
 * 출력: DailyWeather (예보 기준: 기온, 강수량 합, 강수확률 최댓값, 하늘상태), 또는 오류
 * 주의점: 응답 한 번에 항목 전체(기온, 하늘, 강수확률, 강수량, 최저·최고)가 들어 있습니다. 호출은 발표 한 번당 1회입니다.
 *         강수량은 글자로 옵니다 ("강수없음", "1mm 미만", "30~50mm"). parsePrecip이 숫자로 바꿉니다.
 *         "1mm 미만"은 0.5, 범위는 가운데 값으로 씁니다 (추정, 화면에 자세히 쓰지 않습니다).
 *         연장 구간(3시간 간격)은 있는 값만 더하므로 하루 강수량이 실제와 다를 수 있습니다.
 *         서버에서만 실행됩니다. 키는 요청 주소에만 쓰고, 오류 메시지에서는 가립니다.
 */

import { CONFIG } from '../analysis/config'
import { makeStageError, type StageError } from '../analysis/errors'
import type { DailyWeather } from '../analysis/types'
import { aggregateDay } from './forecastDay'
import type { BaseTime } from './forecastBase'
import { redactKey } from './kmaKey'

export const VILAGE_FCST_URL = 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst'

export type ForecastResult = { ok: true; day: DailyWeather; missingHours: number } | { ok: false; error: StageError }
export interface ApiItem { category: string; fcstDate: string; fcstTime: string; fcstValue: string }

export async function fetchForecastDay(
  targetIso: string,
  grid: { nx: number; ny: number },
  base: BaseTime,
  key: string,
): Promise<ForecastResult> {
  const fetched = await fetchItems(grid, base, key)
  if (!fetched.ok) return fetched
  const ymd = targetIso.replace(/-/g, '')
  const day = fetched.items.filter((i) => i.fcstDate === ymd)
  if (day.length === 0) {
    return { ok: false, error: makeStageError('forecast.predict', 'E_FORECAST_EMPTY',
      '목표일 예보 값이 없습니다', '이 날짜가 예보 기간 안에 있는지 확인하세요. 발표 직후라면 잠시 후 다시 시도하세요.') }
  }
  return { ok: true, ...dayFromItems(targetIso, day) }
}

/** 응답 항목을 하루 값으로 묶습니다. */
export function dayFromItems(targetIso: string, day: ApiItem[]): { day: DailyWeather; missingHours: number } {
  const byCat = (cat: string) => day.filter((i) => i.category === cat)
  const hourly = (cat: string) => new Map(byCat(cat).map((i) => [i.fcstTime, i.fcstValue]))
  const temps = hourly('TMP')
  const precips = hourly('PCP')
  const pops = hourly('POP')
  const skys = hourly('SKY')
  const hours = Array.from({ length: CONFIG.forecastHoursPerDay }, (_, h) => `${String(h).padStart(2, '0')}00`)
  const tempList = hours.map((h) => num(temps.get(h)))
  const precipList = hours.map((h) => parsePrecip(precips.get(h)))
  const sample = CONFIG.forecastSampleHours.map((h) => hours[h]!)
  const popList = sample.map((h) => num(pops.get(h)))
  const skyList = sample.map((h) => num(skys.get(h)))
  const out = aggregateDay(targetIso, tempList, precipList, { pops: popList, skys: skyList })
  const tmn = num(byCat('TMN')[0]?.fcstValue)
  const tmx = num(byCat('TMX')[0]?.fcstValue)
  if (tmn !== null) out.tempMin = tmn
  if (tmx !== null) out.tempMax = tmx
  const missingHours = tempList.filter((t) => t === null).length
  return { day: out, missingHours }
}

/** 강수량 글자를 mm 숫자로 바꿉니다. 모르는 글자는 null입니다. */
export function parsePrecip(text: string | undefined): number | null {
  if (text === undefined) return null
  const t = text.trim()
  if (t === '강수없음' || t === '0') return 0
  if (t.startsWith('1mm 미만') || t.startsWith('0.1mm 미만')) return 0.5
  const range = /^([\d.]+)~([\d.]+)mm/.exec(t)
  if (range) return (Number(range[1]) + Number(range[2])) / 2
  const single = /^([\d.]+)mm/.exec(t)
  if (single) return Number(single[1])
  return null
}

async function fetchItems(grid: { nx: number; ny: number }, base: BaseTime, key: string): Promise<{ ok: true; items: ApiItem[] } | { ok: false; error: StageError }> {
  const q = new URLSearchParams({ pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: base.baseDate, base_time: base.baseTime, nx: String(grid.nx), ny: String(grid.ny), authKey: key })
  try {
    const res = await fetch(`${VILAGE_FCST_URL}?${q.toString()}`)
    if (!res.ok) {
      return { ok: false, error: makeStageError('forecast.predict', 'E_FORECAST_FETCH',
        `단기예보 요청이 실패했습니다: HTTP ${res.status}`,
        res.status === 401 || res.status === 403 ? 'API허브에서 "단기예보 조회서비스" 활용신청이 승인됐는지 확인하세요.' : '인터넷 연결과 KMA_API_KEY를 확인하세요.') }
    }
    const json = (await res.json()) as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: ApiItem[] } } } }
    const code = json.response?.header?.resultCode
    if (code !== '00') {
      return { ok: false, error: makeStageError('forecast.predict', 'E_FORECAST_RESPONSE',
        `단기예보 응답 코드 ${code ?? '없음'}: ${json.response?.header?.resultMsg ?? ''}`,
        '발표 시각이 아직 지나지 않았거나 발표가 늦었을 수 있습니다. 잠시 후 다시 시도하세요.') }
    }
    return { ok: true, items: json.response?.body?.items?.item ?? [] }
  } catch (err) {
    return { ok: false, error: makeStageError('forecast.predict', 'E_FORECAST_FETCH',
      `단기예보 요청 중 오류: ${redactKey(err instanceof Error ? err.message : String(err), key)}`,
      '인터넷 연결을 확인하세요.') }
  }
}

function num(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
