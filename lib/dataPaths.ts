import 'server-only'
/**
 * 이 파일이 하는 일: 서버가 읽고 쓰는 폴더 위치를 한 곳에서 정합니다.
 * 입력: 폴더 이름 조각들
 * 출력: 쓰기용 폴더 경로, 읽기 전용 설정 파일 경로
 * 주의점: Vercel 배포본은 소스 폴더에 쓸 수 없어서 임시 폴더(/tmp)를 씁니다. 임시 폴더는 재배포나 일정 시간 뒤 사라집니다.
 *         매장 설정(stores.json)과 관측소 목록은 config/ 에 두고 git에 올립니다 (저장소는 비공개로 만듭니다).
 *         data/ 는 실제 매출과 캐시를 두는 곳이라 git에서 제외합니다.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export function writableDataDir(...parts: string[]): string {
  return process.env.VERCEL ? join(tmpdir(), 'wedoc-data', ...parts) : join(process.cwd(), 'data', ...parts)
}

export function configFilePath(...parts: string[]): string {
  const local = join(process.cwd(), 'data', ...parts)
  if (existsSync(local)) return local
  return join(process.cwd(), 'config', ...parts)
}
