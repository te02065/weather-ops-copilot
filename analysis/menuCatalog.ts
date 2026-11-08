/**
 * 이 파일이 하는 일: 매장 메뉴표(메뉴 이름 → 카테고리)를 검사하고, 새 메뉴에 추천 카테고리를 붙입니다.
 * 입력: 저장된 메뉴표 (JSON으로 읽은 값), 업로드 파일에서 찾은 메뉴 이름 목록, 사용자가 고친 분류
 * 출력: 검사 결과(ok 또는 사람이 읽을 오류), 메뉴별 추천 카테고리와 출처(표 또는 규칙), 합쳐진 메뉴표
 * 주의점: 카테고리는 CATEGORIES에 있는 값만 받습니다. 이름은 앞뒤 공백을 지우고 같은 이름은 하나로 봅니다.
 *         파일 읽기와 쓰기는 weather 폴더가 아니라 menu/catalogFile.ts에서 합니다. 이 파일은 순수 계산만 합니다.
 */

import { CATEGORIES, classifyMenu, type Category } from './menuCategory'

export interface MenuCatalog {
  storeId: string
  items: Record<string, Category>
}

export const MAX_MENU_NAME = 60
export const MAX_MENUS = 500

export type CatalogCheck = { ok: true; catalog: MenuCatalog } | { ok: false; message: string }

/** 저장된 값이나 화면에서 온 값을 검사합니다. 잘못된 항목이 하나라도 있으면 실패입니다. */
export function validateCatalog(input: unknown): CatalogCheck {
  if (typeof input !== 'object' || input === null) return { ok: false, message: '메뉴표 형식이 아닙니다.' }
  const obj = input as { storeId?: unknown; items?: unknown }
  if (typeof obj.storeId !== 'string' || obj.storeId.trim() === '') return { ok: false, message: '매장 번호가 없습니다.' }
  if (typeof obj.items !== 'object' || obj.items === null || Array.isArray(obj.items)) return { ok: false, message: '메뉴 목록이 올바르지 않습니다.' }
  const entries = Object.entries(obj.items as Record<string, unknown>)
  if (entries.length > MAX_MENUS) return { ok: false, message: `메뉴는 ${MAX_MENUS}개까지 저장할 수 있습니다.` }
  const items: Record<string, Category> = {}
  for (const [rawName, rawCat] of entries) {
    const name = rawName.trim()
    if (name === '' || name.length > MAX_MENU_NAME) return { ok: false, message: `메뉴 이름은 1~${MAX_MENU_NAME}자여야 합니다: "${rawName.slice(0, 20)}"` }
    if (!(CATEGORIES as readonly string[]).includes(String(rawCat))) return { ok: false, message: `카테고리가 올바르지 않습니다: "${String(rawCat)}"` }
    items[name] = rawCat as Category
  }
  return { ok: true, catalog: { storeId: obj.storeId.trim(), items } }
}

export interface SuggestedMenu { name: string; category: Category; source: 'catalog' | 'rule' }

/** 업로드 파일의 메뉴 이름마다 카테고리를 붙입니다. 표에 있으면 표, 없으면 규칙을 씁니다. */
export function suggestCategories(menuNames: string[], catalog: MenuCatalog): SuggestedMenu[] {
  const seen = new Set<string>()
  const out: SuggestedMenu[] = []
  for (const raw of menuNames) {
    const name = raw.trim()
    if (name === '' || seen.has(name)) continue
    seen.add(name)
    const inCatalog = catalog.items[name]
    out.push(inCatalog
      ? { name, category: inCatalog, source: 'catalog' }
      : { name, category: classifyMenu(name), source: 'rule' })
  }
  return out
}

/** 사용자가 고친 분류를 표에 합칩니다. 카테고리 값은 다시 검사합니다. */
export function mergeCatalog(catalog: MenuCatalog, changes: Record<string, string>): CatalogCheck {
  return validateCatalog({ storeId: catalog.storeId, items: { ...catalog.items, ...changes } })
}
