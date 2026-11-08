import 'server-only'
/**
 * 이 파일이 하는 일: 기상청 API 인증키(KMA_API_KEY)를 환경변수에서 읽습니다.
 * 입력: 환경변수 (보통 .env.local에서 로드된 process.env)
 * 출력: 키 문자열, 또는 키가 없을 때 E_KMA_KEY_MISSING 오류
 * 주의점: 이 파일은 서버에서만 실행됩니다. import "server-only"가 있어서,
 *         브라우저 코드에서 가져오면 빌드가 실패합니다 (설계 원칙 4).
 *         키 값은 로그, 오류 메시지, 화면, 문서 어디에도 쓰지 않습니다.
 *         상태 표시는 "설정됨/없음"만 돌려줍니다.
 */

import { makeStageError, type StageError } from '../analysis/errors'

export const KMA_KEY_NAME = 'KMA_API_KEY'

export type KeyResult = { ok: true; key: string } | { ok: false; error: StageError }

/** 키를 읽습니다. 없거나 비어 있으면 안내 문구가 담긴 오류를 돌려줍니다. */
export function readKmaKey(env: Record<string, string | undefined> = process.env): KeyResult {
  const key = (env[KMA_KEY_NAME] ?? '').trim()
  if (key === '') {
    return {
      ok: false,
      error: makeStageError('weather.fetch', 'E_KMA_KEY_MISSING',
        'KMA_API_KEY가 .env.local에 없습니다',
        '.env.local 파일에 KMA_API_KEY=발급받은키 한 줄을 추가하고 서버를 다시 실행하세요.'),
    }
  }
  return { ok: true, key }
}

/** 화면과 로그에 쓸 수 있는 상태 문구. 키 값은 들어가지 않습니다. */
export function kmaKeyStatus(env: Record<string, string | undefined> = process.env): string {
  return readKmaKey(env).ok ? 'KMA_API_KEY 설정됨' : 'KMA_API_KEY 없음'
}

/** 텍스트에 키가 섞여 있으면 가립니다 (오류 메시지가 키를 되받아 쓰는 경우 대비). */
export function redactKey(text: string, key: string): string {
  return key === '' ? text : text.split(key).join('***')
}
