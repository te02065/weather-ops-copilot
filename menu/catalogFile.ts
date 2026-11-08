/**
 * 이 파일이 하는 일: 매장 메뉴표를 data/menu_catalog/<매장번호>.json 파일로 읽고 씁니다.
 * 입력: 저장 폴더, 매장 번호, 저장할 메뉴표
 * 출력: 메뉴표 (없으면 빈 표), 저장 결과
 * 주의점: data/ 폴더는 git에서 제외됩니다. 메뉴 이름은 사업 정보이므로 여기에만 둡니다.
 *         매장 번호는 영문, 숫자, -, _ 만 씁니다 (경로 공격 방지).
 *         읽을 때 형식이 틀리면 빈 표로 바꾸지 않고 오류를 돌려줍니다 (사용자 수정이 사라지지 않도록).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { validateCatalog, type MenuCatalog } from '../analysis/menuCatalog'

export const CATALOG_DIR = join(process.cwd(), 'data', 'menu_catalog')

const STORE_ID = /^[A-Za-z0-9_-]{1,40}$/

export function isValidStoreId(storeId: string): boolean {
  return STORE_ID.test(storeId)
}

export function catalogPath(dir: string, storeId: string): string {
  return join(dir, `${storeId}.json`)
}

export type ReadResult = { ok: true; catalog: MenuCatalog } | { ok: false; message: string }

export function readCatalog(dir: string, storeId: string): ReadResult {
  if (!isValidStoreId(storeId)) return { ok: false, message: '매장 번호 형식이 올바르지 않습니다.' }
  const path = catalogPath(dir, storeId)
  if (!existsSync(path)) return { ok: true, catalog: { storeId, items: {} } }
  try {
    const check = validateCatalog(JSON.parse(readFileSync(path, 'utf-8')))
    return check.ok ? { ok: true, catalog: check.catalog } : { ok: false, message: `저장된 메뉴표를 읽지 못했습니다: ${check.message}` }
  } catch {
    return { ok: false, message: '저장된 메뉴표 파일이 깨졌습니다. 파일을 확인하세요.' }
  }
}

export function writeCatalog(dir: string, catalog: MenuCatalog): { ok: true } | { ok: false; message: string } {
  if (!isValidStoreId(catalog.storeId)) return { ok: false, message: '매장 번호 형식이 올바르지 않습니다.' }
  mkdirSync(dir, { recursive: true })
  writeFileSync(catalogPath(dir, catalog.storeId), JSON.stringify(catalog, null, 2), 'utf-8')
  return { ok: true }
}
