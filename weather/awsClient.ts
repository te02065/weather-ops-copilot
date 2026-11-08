import 'server-only'
/**
 * 이 파일이 하는 일: 기상청 API허브에서 AWS 매분자료를 하루치 요청합니다 (지점 1곳, 하루 이내 제한).
 * 입력: 지점 번호, 날짜(YYYY-MM-DD), 인증키
 * 출력: 응답 텍스트, 또는 오류
 * 주의점: 서버에서만 실행됩니다. 키는 요청 주소에만 붙고 오류 메시지에서는 가려집니다.
 *         자동 테스트는 이 함수를 호출하지 않습니다. 실제 호출은 npm run aws-probe 로 직접 실행할 때만 합니다.
 */

import { makeStageError, type StageError } from '../analysis/errors'
import { redactKey } from './kmaKey'

export const KMA_AWS_MINUTE_URL = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min'

export type AwsFetchResult = { ok: true; text: string } | { ok: false; error: StageError }

export async function fetchAwsMinuteDay(stationId: string, date: string, key: string): Promise<AwsFetchResult> {
  const ymd = date.replace(/-/g, '')
  const query = new URLSearchParams({ tm1: `${ymd}0000`, tm2: `${ymd}2359`, stn: stationId, disp: '0', help: '1', authKey: key })
  try {
    const res = await fetch(`${KMA_AWS_MINUTE_URL}?${query.toString()}`)
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, error: makeStageError('weather.fetch', 'E_KMA_FETCH',
        `AWS 요청이 실패했습니다: HTTP ${res.status}`,
        res.status === 401 || res.status === 403
          ? 'API허브에서 "방재 기상관측(AWS) 매분자료" 활용신청이 승인됐는지 확인하세요.'
          : '인터넷 연결과 KMA_API_KEY를 확인하세요.') }
    }
    return { ok: true, text }
  } catch (err) {
    return { ok: false, error: makeStageError('weather.fetch', 'E_KMA_FETCH',
      `AWS 요청 중 오류: ${redactKey(err instanceof Error ? err.message : String(err), key)}`,
      '인터넷 연결을 확인하세요.') }
  }
}
