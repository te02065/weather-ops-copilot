/**
 * 이 파일이 하는 일: POS 매출 리포트(엑셀 시트 묶음)를 읽어 일별 매출, 메뉴별 매출, 제외 집계, 대조 결과를 만듭니다.
 * 입력: readXlsx가 돌려준 시트별 표 (결제 합계, 상품 주문 합계, 상품 주문 상세내역을 씁니다)
 * 출력: 기간, 일별 결제금액(순매출), 날짜 × POS카테고리 × 메뉴 금액, 옵션 연결 결과, 대조 결과, 경고
 * 주의점: 매출은 "결제금액"(취소를 뺀 순매출, 부가세 포함)을 씁니다.
 *         옵션 추가금은 매출에 포함합니다. 주문 안에 메뉴가 하나뿐이면 그 메뉴에 붙이고, 여러 개면 "메뉴 연결 불가"로 따로 둡니다.
 *         POS 카테고리가 빈 메뉴는 같은 메뉴 이름의 다른 줄 카테고리로 채웁니다. 그래도 없으면 "(미분류)"로 둡니다.
 *         대조에서 1원을 넘는 차이는 "무시한 차이"로 따로 셉니다. 원인을 모르는 금액은 분석에서 뺍니다.
 *         열은 위치가 아니라 이름으로 찾습니다. 빈 끝 칸이 생략되므로 행을 열 수에 맞춰 채웁니다.
 */

import { posCategoryKey, lineKind, menuKey, baseMenuName, type LineKind } from './posRules'
import type { SheetRows } from './xlsx'

const DATE = /^\d{4}-\d{2}-\d{2}$/
export const SALES_SHEET = '결제 합계'
const PRODUCT_SHEET = '상품 주문 합계'
const DETAIL_SHEET = '상품 주문 상세내역'

export interface DailyPos { date: string; netSales: number; vat: number; payCount: number }
export interface MenuDaily { date: string; posCategory: string; menu: string; menuKey: string; qty: number; amount: number }
export interface Excluded { kind: Exclude<LineKind, 'menu'>; rows: number; amount: number }
export interface OptionSummary { attached: { rows: number; amount: number }; unlinked: { rows: number; amount: number } }
export interface PosReport {
  period: { start: string; end: string } | null
  daily: DailyPos[]
  menuDaily: MenuDaily[]
  excluded: Excluded[]
  options: OptionSummary
  categoryFilled: number
  reconcile: { days: number; matchedDays: number; ignoredDays: number; ignoredGap: number }
  warnings: string[]
}

export function parsePosReport(sheets: Record<string, SheetRows>): PosReport {
  const warnings: string[] = []
  const pay = sheets[SALES_SHEET]
  const prod = sheets[PRODUCT_SHEET]
  if (!pay || !prod) {
    return emptyReport([`시트를 찾지 못했습니다: ${[SALES_SHEET, PRODUCT_SHEET].filter((n) => !sheets[n]).join(', ')}`])
  }
  const daily = readDaily(pay, warnings)
  const lines = readLines(prod, warnings)
  const detail = sheets[DETAIL_SHEET] ? readOptions(sheets[DETAIL_SHEET]!, warnings) : null
  const menuDaily = Array.from(lines.menu.values())
  if (detail) menuDaily.push(...detail.attachedMenus)
  const other = new Map<string, number>()
  const addOther = (date: string, v: number) => other.set(date, (other.get(date) ?? 0) + v)
  for (const [d, v] of Array.from(lines.otherByDate.entries())) addOther(d, v)
  if (detail) for (const [d, v] of Array.from(detail.unlinkedByDate.entries())) addOther(d, v)
  else for (const [d, v] of Array.from(lines.optionByDate.entries())) addOther(d, v)
  const categoryFilled = fillCategories(menuDaily)
  const reconcile = checkReconcile(daily, mergeMenus(menuDaily), other)
  const dates = daily.map((d) => d.date).sort()
  return {
    period: dates.length ? { start: dates[0]!, end: dates[dates.length - 1]! } : null,
    daily,
    menuDaily: mergeMenus(menuDaily),
    excluded: Array.from(lines.excluded.values()),
    options: {
      attached: { rows: detail?.attachedRows ?? 0, amount: detail?.attachedAmount ?? 0 },
      unlinked: { rows: detail?.unlinkedRows ?? 0, amount: detail?.unlinkedAmount ?? 0 },
    },
    categoryFilled,
    reconcile,
    warnings,
  }
}

function emptyReport(warnings: string[]): PosReport {
  return {
    period: null, daily: [], menuDaily: [], excluded: [],
    options: { attached: { rows: 0, amount: 0 }, unlinked: { rows: 0, amount: 0 } },
    categoryFilled: 0,
    reconcile: { days: 0, matchedDays: 0, ignoredDays: 0, ignoredGap: 0 },
    warnings,
  }
}

/** 열 이름 찾기: 머리글 줄에서 이름이 같은 열의 위치. 줄바꿈과 앞뒤 공백은 무시합니다. */
export function findColumn(header: Array<string | null>, name: string): number {
  const want = normalizeHeader(name)
  return header.findIndex((h) => normalizeHeader(h ?? '') === want)
}

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** 행을 열 수에 맞춰 채웁니다 (엑셀은 끝의 빈 칸을 적지 않습니다). */
function padRow(row: Array<string | null>, width: number): Array<string | null> {
  return row.length >= width ? row : [...row, ...Array<null>(width - row.length).fill(null)]
}

function num(s: string | null | undefined): number {
  if (s === null || s === undefined || s.trim() === '') return 0
  const v = Number(s.replace(/,/g, ''))
  return Number.isFinite(v) ? v : 0
}

/** 머리글 줄 찾기 (이름이 있는 줄) */
function headerRow(rows: SheetRows, name: string): number {
  return rows.findIndex((r) => r.some((c) => normalizeHeader(c ?? '') === name))
}

function readDaily(pay: SheetRows, warnings: string[]): DailyPos[] {
  const headerIdx = headerRow(pay, '기간')
  if (headerIdx < 0) { warnings.push('결제 합계 시트에서 "기간" 열을 찾지 못했습니다.'); return [] }
  const header = pay[headerIdx]!
  const cDate = findColumn(header, '기간')
  const cNet = findColumn(header, '결제금액')
  const cVat = findColumn(header, '부가세')
  const cCount = findColumn(header, '결제건수')
  if (cNet < 0) warnings.push('결제 합계 시트에서 "결제금액" 열을 찾지 못했습니다.')
  const out: DailyPos[] = []
  for (const raw of pay.slice(headerIdx + 1)) {
    const row = padRow(raw, header.length)
    const date = (row[cDate] ?? '').trim()
    if (!DATE.test(date)) continue
    out.push({ date, netSales: num(row[cNet]), vat: num(row[cVat]), payCount: num(row[cCount]) })
  }
  return out
}

interface ReadLines {
  menu: Map<string, MenuDaily>
  excluded: Map<Excluded['kind'], Excluded>
  otherByDate: Map<string, number>
  optionByDate: Map<string, number>
}

/** 상품 주문 합계: 메뉴 줄을 날짜×카테고리×메뉴로 모읍니다. 옵션은 따로 셉니다. */
function readLines(prod: SheetRows, warnings: string[]): ReadLines {
  const out: ReadLines = { menu: new Map(), excluded: new Map(), otherByDate: new Map(), optionByDate: new Map() }
  const headerIdx = headerRow(prod, '상품명')
  if (headerIdx < 0) { warnings.push('상품 주문 합계 시트에서 "상품명" 열을 찾지 못했습니다.'); return out }
  const header = prod[headerIdx]!
  const cDate = findColumn(header, '기간')
  const cName = findColumn(header, '상품명')
  const cCat = findColumn(header, '카테고리')
  const cQty = findColumn(header, '판매건수')
  const cAmt = header.findIndex((h) => normalizeHeader(h ?? '').startsWith('실 판매 금액'))
  if (cAmt < 0) warnings.push('상품 주문 합계 시트에서 "실 판매 금액" 열을 찾지 못했습니다.')
  for (const raw of prod.slice(headerIdx + 1)) {
    const row = padRow(raw, header.length)
    const date = (row[cDate] ?? '').trim()
    const name = (row[cName] ?? '').trim()
    if (!DATE.test(date) || name === '') continue
    const posCategory = (row[cCat] ?? '').trim()
    const amount = num(row[cAmt])
    const kind = lineKind(name, posCategory)
    if (kind === 'option') {
      out.optionByDate.set(date, (out.optionByDate.get(date) ?? 0) + amount)
      addExcluded(out.excluded, kind, amount)
      continue
    }
    if (kind !== 'menu') {
      out.otherByDate.set(date, (out.otherByDate.get(date) ?? 0) + amount)
      addExcluded(out.excluded, kind, amount)
      continue
    }
    addMenu(out.menu, { date, posCategory: posCategoryKey(posCategory), menu: baseMenuName(name), menuKey: menuKey(name), qty: num(row[cQty]), amount })
  }
  return out
}

interface OptionRead {
  attachedMenus: MenuDaily[]
  unlinkedByDate: Map<string, number>
  attachedRows: number
  attachedAmount: number
  unlinkedRows: number
  unlinkedAmount: number
}

/**
 * 상품 주문 상세내역: 같은 주문(날짜 + 주문번호) 안에서 메뉴가 하나뿐인 옵션만 그 메뉴에 붙입니다.
 * 메뉴가 여러 개인 주문의 옵션은 어느 메뉴 것인지 알 수 없으므로 "메뉴 연결 불가"로 둡니다. 금액은 매출에 그대로 포함합니다.
 */
function readOptions(detail: SheetRows, warnings: string[]): OptionRead {
  const headerIdx = headerRow(detail, '상품명')
  const res: OptionRead = { attachedMenus: [], unlinkedByDate: new Map(), attachedRows: 0, attachedAmount: 0, unlinkedRows: 0, unlinkedAmount: 0 }
  if (headerIdx < 0) { warnings.push('상품 주문 상세내역 시트에서 "상품명" 열을 찾지 못했습니다.'); return res }
  const header = detail[headerIdx]!
  const cDate = findColumn(header, '주문기준일자')
  const cOrder = findColumn(header, '주문번호')
  const cName = findColumn(header, '상품명')
  const cCat = findColumn(header, '카테고리')
  const cAmt = header.findIndex((h) => normalizeHeader(h ?? '').startsWith('실판매금액'))
  if (cAmt < 0) warnings.push('상품 주문 상세내역 시트에서 "실판매금액" 열을 찾지 못했습니다.')
  const orders = new Map<string, { menus: Array<{ name: string; cat: string; amount: number }>; options: number[] }>()
  for (const raw of detail.slice(headerIdx + 1)) {
    const row = padRow(raw, header.length)
    const date = (row[cDate] ?? '').trim()
    const name = (row[cName] ?? '').trim()
    if (!DATE.test(date) || name === '') continue
    const kind = lineKind(name, (row[cCat] ?? '').trim())
    const key = `${date}|${(row[cOrder] ?? '').trim()}`
    const o = orders.get(key) ?? { menus: [], options: [] }
    const amount = num(row[cAmt])
    if (kind === 'option') o.options.push(amount)
    else if (kind === 'menu') o.menus.push({ name, cat: (row[cCat] ?? '').trim(), amount })
    orders.set(key, o)
  }
  const attached = new Map<string, MenuDaily>()
  for (const [key, o] of Array.from(orders.entries())) {
    const date = key.split('|')[0]!
    const optionSum = o.options.reduce((s, x) => s + x, 0)
    if (o.options.length === 0) continue
    if (o.menus.length === 1) {
      const m = o.menus[0]!
      res.attachedRows += o.options.length
      res.attachedAmount += optionSum
      addMenu(attached, { date, posCategory: posCategoryKey(m.cat), menu: baseMenuName(m.name), menuKey: menuKey(m.name), qty: 0, amount: optionSum })
    } else {
      res.unlinkedRows += o.options.length
      res.unlinkedAmount += optionSum
      res.unlinkedByDate.set(date, (res.unlinkedByDate.get(date) ?? 0) + optionSum)
    }
  }
  res.attachedMenus = Array.from(attached.values())
  return res
}

function addExcluded(map: Map<Excluded['kind'], Excluded>, kind: Excluded['kind'], amount: number): void {
  const cur = map.get(kind) ?? { kind, rows: 0, amount: 0 }
  cur.rows += 1
  cur.amount += amount
  map.set(kind, cur)
}

function addMenu(map: Map<string, MenuDaily>, row: MenuDaily): void {
  const key = `${row.date}|${row.posCategory}|${row.menuKey}`
  const cur = map.get(key)
  if (cur) { cur.qty += row.qty; cur.amount += row.amount; return }
  map.set(key, { ...row })
}

/** 같은 날·같은 카테고리·같은 메뉴 키로 한 번 더 합칩니다 (옵션을 붙인 뒤). */
function mergeMenus(list: MenuDaily[]): MenuDaily[] {
  const map = new Map<string, MenuDaily>()
  for (const m of list) addMenu(map, m)
  return Array.from(map.values())
}

/**
 * 빈 POS 카테고리를 같은 메뉴 키의 다른 줄 카테고리로 채웁니다. 여러 개면 가장 많이 쓰인 것.
 * 반환값: 채운 줄 수.
 */
function fillCategories(list: MenuDaily[]): number {
  const votes = new Map<string, Map<string, number>>()
  for (const m of list) {
    if (m.posCategory === '(미분류)') continue
    const v = votes.get(m.menuKey) ?? new Map<string, number>()
    v.set(m.posCategory, (v.get(m.posCategory) ?? 0) + 1)
    votes.set(m.menuKey, v)
  }
  let filled = 0
  for (const m of list) {
    if (m.posCategory !== '(미분류)') continue
    const v = votes.get(m.menuKey)
    if (!v) continue
    const best = Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0]![0]
    m.posCategory = best
    filled += 1
  }
  return filled
}

/**
 * 날짜별 대조: 메뉴 금액 + 연결하지 못한 금액 + 배달료 = 결제금액.
 * 1원을 넘는 차이는 "무시한 차이"로 셉니다 (원인을 모르는 금액은 분석에서 뺍니다).
 */
function checkReconcile(daily: DailyPos[], menu: MenuDaily[], other: Map<string, number>) {
  const sums = new Map<string, number>()
  for (const m of menu) sums.set(m.date, (sums.get(m.date) ?? 0) + m.amount)
  let matched = 0
  let ignoredDays = 0
  let ignoredGap = 0
  for (const d of daily) {
    const gap = d.netSales - ((sums.get(d.date) ?? 0) + (other.get(d.date) ?? 0))
    if (Math.abs(gap) <= 1) matched += 1
    else { ignoredDays += 1; ignoredGap += Math.abs(gap) }
  }
  return { days: daily.length, matchedDays: matched, ignoredDays, ignoredGap: Math.round(ignoredGap) }
}
