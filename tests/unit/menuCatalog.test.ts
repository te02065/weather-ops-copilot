/**
 * 이 파일이 하는 일: 매장 메뉴표 검사, 추천 카테고리, 합치기, 파일 읽고 쓰기 테스트.
 * 입력: 작은 메뉴표 예시, 임시 폴더 (테스트가 만들고 끝나면 지웁니다)
 * 출력: 테스트 통과/실패
 * 주의점: 실제 data/menu_catalog 폴더는 건드리지 않습니다.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { mergeCatalog, suggestCategories, validateCatalog } from '../../analysis/menuCatalog'
import { catalogPath, isValidStoreId, readCatalog, writeCatalog } from '../../menu/catalogFile'

test('검사: 허용되지 않는 카테고리와 긴 이름은 실패', () => {
  assert.equal(validateCatalog({ storeId: 'CAFE-A', items: { 아메리카노: '음료' } }).ok, false)
  assert.equal(validateCatalog({ storeId: 'CAFE-A', items: { ['가'.repeat(61)]: '기타' } }).ok, false)
  const ok = validateCatalog({ storeId: 'CAFE-A', items: { ' 아메리카노 ': '음료 (온도 미정)' } })
  assert.ok(ok.ok && ok.catalog.items['아메리카노'] === '음료 (온도 미정)')
})

test('추천: 표에 있으면 표 값, 없으면 규칙 값, 같은 이름은 한 번만', () => {
  const catalog = { storeId: 'CAFE-A', items: { '아이스 아메리카노': '핫 음료' as const } }
  const r = suggestCategories(['아이스 아메리카노', '치즈 케이크', '치즈 케이크', ' '], catalog)
  assert.deepEqual(r, [
    { name: '아이스 아메리카노', category: '핫 음료', source: 'catalog' },
    { name: '치즈 케이크', category: '디저트·베이커리', source: 'rule' },
  ])
})

test('합치기: 고친 분류가 기존 표를 덮고, 잘못된 값이면 실패', () => {
  const base = { storeId: 'CAFE-A', items: { 라떼: '음료 (온도 미정)' as const } }
  const merged = mergeCatalog(base, { 라떼: '핫 음료' })
  assert.ok(merged.ok && merged.catalog.items['라떼'] === '핫 음료')
  assert.equal(mergeCatalog(base, { 라떼: '잘못' }).ok, false)
})

test('매장 번호: 영문, 숫자, -, _ 만 허용 (경로 문자 금지)', () => {
  assert.equal(isValidStoreId('CAFE-A'), true)
  assert.equal(isValidStoreId('../etc'), false)
  assert.equal(isValidStoreId(''), false)
})

test('파일: 쓰고 다시 읽으면 같고, 없으면 빈 표, 깨졌으면 오류', () => {
  const dir = mkdtempSync(join(tmpdir(), 'menu-catalog-'))
  try {
    assert.deepEqual(readCatalog(dir, 'CAFE-A'), { ok: true, catalog: { storeId: 'CAFE-A', items: {} } })
    const catalog = { storeId: 'CAFE-A', items: { '아이스 라떼': '아이스 음료' as const } }
    assert.deepEqual(writeCatalog(dir, catalog), { ok: true })
    assert.deepEqual(readCatalog(dir, 'CAFE-A'), { ok: true, catalog })
    mkdirSync(dir, { recursive: true })
    writeFileSync(catalogPath(dir, 'CAFE-B'), '{ 깨진 글', 'utf-8')
    assert.equal(readCatalog(dir, 'CAFE-B').ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
