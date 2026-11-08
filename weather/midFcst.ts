import 'server-only'
/**
 * 이 파일이 하는 일: 기상청 중기예보(getMidTa 기온, getMidLandFcst 강수확률·날씨)를 받아 날짜별 값으로 바꿉니다.
 * 입력: 발표일(YYYYMMDD, 06시 발표), 인증키
 * 출력: 날짜(YYYY-MM-DD)별 { taMin, taMax, rnStAm, rnStPm, wfAm, wfPm }, 또는 오류
 * 주의점: 대구 기온 구역 11H10701, 대구·경북 육상 구역 11H10000 (docs/중기예보_API_판단.md).
 *         강수확률은 강수량(mm)이 아닙니다. 두 값 중 큰 것을 "비 가능성"으로 씁니다.
 *         발표 후 24시간 안의 자료만 옵니다. 값이 없으면 NO_DATA(03)를 돌려줍니다.
 *         키는 요청 주소에만 쓰고 오류 메시지에서는 가립니다.
 */

import { makeStageError, type StageError } from '../analysis/errors'
import { addDaysIso } from '../analysis/dates'
import { redactKey } from './kmaKey'

export const MID_TEMP_REGION = '11H10701'   // 대구 (중기기온 구역)
export const MID_LAND_REGION = '11H10000'   // 대구·경상북도 (중기 육상 구역)
const BASE = 'https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService'

export interface MidDay { taMin: number | null; taMax: number | null; rnStAm: number | null; rnStPm: number | null; wfAm: string | null; wfPm: string | null }
export type MidResult = { ok: true; days: Record<string, MidDay> } | { ok: false; error: StageError }

/** XML 응답의 한 항목 값. 없으면 null. */
export function xmlValue(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)
  return m ? m[1]!.trim() : null
}

function num(v: string | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 발표일(YYYYMMDD) 기준 +k일 날짜. 중기는 k=4~10 을 씁니다. */
export function midDates(baseYmd: string): Array<{ k: number; date: string }> {
  const iso = `${baseYmd.slice(0, 4)}-${baseYmd.slice(4, 6)}-${baseYmd.slice(6, 8)}`
  return Array.from({ length: 7 }, (_, i) => ({ k: i + 4, date: addDaysIso(iso, i + 4) }))
}

/** 기온과 강수 응답을 날짜별 값으로 합칩니다. */
export function parseMid(taXml: string, landXml: string, baseYmd: string): Record<string, MidDay> {
  const out: Record<string, MidDay> = {}
  for (const { k, date } of midDates(baseYmd)) {
    out[date] = {
      taMin: num(xmlValue(taXml, `taMin${k}`)),
      taMax: num(xmlValue(taXml, `taMax${k}`)),
      // 8~10일 뒤는 오전·오후 구분 없이 하루 값(rnSt8, wf8 …)으로 옵니다
      rnStAm: num(xmlValue(landXml, k <= 7 ? `rnSt${k}Am` : `rnSt${k}`)),
      rnStPm: k <= 7 ? num(xmlValue(landXml, `rnSt${k}Pm`)) : null,
      wfAm: xmlValue(landXml, k <= 7 ? `wf${k}Am` : `wf${k}`),
      wfPm: k <= 7 ? xmlValue(landXml, `wf${k}Pm`) : null,
    }
  }
  return out
}

async function call(op: string, regId: string, baseYmd: string, key: string): Promise<{ ok: true; xml: string } | { ok: false; error: StageError }> {
  const q = new URLSearchParams({ pageNo: '1', numOfRows: '10', dataType: 'XML', regId, tmFc: `${baseYmd}0600`, authKey: key })
  try {
    const res = await fetch(`${BASE}/${op}?${q.toString()}`)
    const xml = await res.text()
    const code = xmlValue(xml, 'resultCode')
    if (!res.ok || code !== '00') {
      return { ok: false, error: makeStageError('weather.fetch', code === '03' ? 'E_MID_NO_DATA' : 'E_MID_FETCH',
        `중기예보(${op}) 응답 코드: ${code ?? res.status}`,
        code === '03' ? '발표 시각이 아직 나오지 않았거나 24시간이 지났습니다. 06시 발표 이후 다시 시도하세요.'
          : 'API허브에서 중기예보 활용신청과 인증키를 확인하세요.') }
    }
    return { ok: true, xml }
  } catch (err) {
    return { ok: false, error: makeStageError('weather.fetch', 'E_MID_FETCH',
      `중기예보 요청 중 오류: ${redactKey(err instanceof Error ? err.message : String(err), key)}`, '인터넷 연결을 확인하세요.') }
  }
}

/** 06시 발표 하나를 받아 날짜별 값을 돌려줍니다. */
export async function fetchMid(baseYmd: string, key: string): Promise<MidResult> {
  const ta = await call('getMidTa', MID_TEMP_REGION, baseYmd, key)
  if (!ta.ok) return ta
  const land = await call('getMidLandFcst', MID_LAND_REGION, baseYmd, key)
  if (!land.ok) return land
  return { ok: true, days: parseMid(ta.xml, land.xml, baseYmd) }
}
