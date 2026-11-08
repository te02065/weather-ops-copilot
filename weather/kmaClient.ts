import 'server-only'
/**
 * 이 파일이 하는 일: 기상청 API허브에 ASOS 일자료를 요청합니다. 일시적인 실패는 설정된 횟수만큼 다시 시도합니다.
 * 입력: 요청 변수(관측소, 기간), 인증키, (테스트용) fetch 함수
 * 출력: 응답 텍스트, 또는 E_KMA_FETCH 오류
 * 주의점: 이 파일은 서버에서만 실행됩니다 (import "server-only"). 키는 요청 주소에만 붙고,
 *         오류 메시지에서는 가려서 보여 줍니다. 자동 테스트에서는 이 파일의 네트워크 함수를 호출하지 않습니다
 *         (테스트는 가짜 fetch를 넣습니다). 실제 호출은 npm run kma 로 직접 실행할 때만 합니다.
 *         4xx 응답(예: 403 권한 없음)은 재시도해도 바뀌지 않으므로 바로 멈춥니다.
 *         재시도 횟수는 analysis/config.ts의 kmaRetryCount, 제한 시간은 kmaTimeoutMs입니다.
 */

import { CONFIG } from '../analysis/config'
import { makeStageError, type StageError } from '../analysis/errors'
import { redactKey } from './kmaKey'
import { buildAsosQuery } from './asos'

/** 기상청 API허브 ASOS 일자료 주소 (문서에서 확인한 값, 응답 형식은 [확인 필요]). */
export const KMA_ASOS_DAILY_URL = 'https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd3.php'

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

export type AsosFetchResult = { ok: true; text: string } | { ok: false; error: StageError }

export async function fetchAsosText(
  request: { stationId: string; start: string; end: string },
  key: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<AsosFetchResult> {
  const attempts = 1 + CONFIG.kmaRetryCount
  const query = new URLSearchParams({ ...buildAsosQuery(request.stationId, request.start, request.end), authKey: key })
  const url = `${KMA_ASOS_DAILY_URL}?${query.toString()}`
  let lastReason = '알 수 없는 오류'
  let lastStatus: number | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await fetchWithTimeout(fetchImpl, url)
      return { ok: true, text }
    } catch (err) {
      const status = (err as { status?: number }).status ?? null
      lastReason = redactKey(err instanceof Error ? err.message : String(err), key)
      lastStatus = status
      if (status !== null && status >= 400 && status < 500) break // 권한·요청 오류는 다시 해도 같습니다
    }
  }
  const denied = lastStatus === 401 || lastStatus === 403
  return {
    ok: false,
    error: makeStageError('weather.fetch', 'E_KMA_FETCH',
      `기상청 요청이 실패했습니다: ${lastReason}`,
      denied
        ? '인증키는 있지만 권한이 없다는 응답입니다. 기상청 API허브에서 "종관기상관측(ASOS) 일자료" 활용신청이 승인됐는지 확인하세요.'
        : '인터넷 연결과 KMA_API_KEY가 맞는지 확인하세요. 예전 캐시가 있으면 그 값을 쓰고 stale 표시를 붙입니다.'),
  }
}

/** 제한 시간을 둔 요청 한 번. 응답이 정상(2xx)이 아니면 status를 붙인 오류를 던집니다. */
async function fetchWithTimeout(fetchImpl: FetchLike, url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONFIG.kmaTimeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}
