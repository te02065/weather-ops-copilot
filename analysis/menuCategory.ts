/**
 * 이 파일이 하는 일: 메뉴 이름을 카테고리로 나누고, 파일 형식(길게·넓게)을 알아보고, 날짜별 카테고리 합계를 만듭니다.
 * 입력: 열 이름 목록, 메뉴 이름, 매장 메뉴표(사용자가 고친 분류, 없으면 빈 객체)
 * 출력: 카테고리 이름, 형식 판별 결과, 날짜 × 카테고리 금액 합계
 * 주의점: 키워드 규칙은 설계 문서(docs/메뉴카테고리_설계.md) §4와 같아야 합니다.
 *         매장 메뉴표가 기본 규칙보다 우선합니다. 카테고리 이름은 CATEGORIES 목록에 있는 것만 씁니다.
 *         금액 합계에는 메뉴 원본 이름을 넣지 않습니다 (로그와 결과 보호).
 */

export const CATEGORIES = ['아이스 음료', '핫 음료', '음료 (온도 미정)', '디저트·베이커리', '기타'] as const
export type Category = (typeof CATEGORIES)[number]

/** 규칙 순서가 중요합니다. 아이스·핫이 먼저 적용됩니다. */
const RULES: Array<{ category: Category; words: string[] }> = [
  { category: '아이스 음료', words: ['아이스', 'ICE', '콜드', 'COLD', '에이드', '스무디', '프라페'] },
  { category: '핫 음료', words: ['핫', 'HOT', '따뜻'] },
  { category: '디저트·베이커리', words: ['케이크', '쿠키', '빵', '크로플', '마카롱', '머핀', '디저트'] },
  { category: '음료 (온도 미정)', words: ['아메리카노', '라떼', '티', '차', '주스'] },
]

/** 메뉴 이름 하나의 카테고리. 매장 메뉴표에 있으면 그 값을 씁니다. */
export function classifyMenu(name: string, overrides: Record<string, Category> = {}): Category {
  const trimmed = name.trim()
  if (overrides[trimmed]) return overrides[trimmed]!
  const upper = trimmed.toUpperCase()
  for (const rule of RULES) {
    if (rule.words.some((w) => upper.includes(w.toUpperCase()))) return rule.category
  }
  return '기타'
}

const DATE_NAMES = ['날짜', '영업일', 'date']
const MENU_NAMES = ['메뉴', '메뉴명', '상품', '상품명', '품목', 'menu', 'item']
const AMOUNT_NAMES = ['금액', '매출', '매출액', '판매금액', 'sales', 'amount']
const NOT_MENU = ['거래', '거래수', '거래 수', 'transactions', 'ice_sales', 'hot_sales', 'sales', '매출', '합계']

export type MenuFormat =
  | { kind: 'long'; dateCol: string; menuCol: string; amountCol: string }
  | { kind: 'wide'; dateCol: string; menuCols: string[] }
  | { kind: 'none' }

/** 열 이름으로 파일 형식을 알아봅니다. 애매하면 none을 돌려 사용자가 고르게 합니다. */
export function detectMenuFormat(headers: string[]): MenuFormat {
  const find = (names: string[]) => headers.find((h) => names.includes(h.trim().toLowerCase()) || names.includes(h.trim()))
  const dateCol = find(DATE_NAMES)
  if (!dateCol) return { kind: 'none' }
  const menuCol = find(MENU_NAMES)
  const amountCol = find(AMOUNT_NAMES)
  if (menuCol && amountCol) return { kind: 'long', dateCol, menuCol, amountCol }
  const menuCols = headers.filter((h) => h !== dateCol && !NOT_MENU.includes(h.trim().toLowerCase()) && !NOT_MENU.includes(h.trim()))
  return menuCols.length >= 2 ? { kind: 'wide', dateCol, menuCols } : { kind: 'none' }
}

export interface LongRow { date: string; menu: string; amount: number | null }

/** 길게 형식: 날짜 × 카테고리 금액 합계. 금액이 없는 줄은 빼고, 그 수를 함께 돌려줍니다. */
export function sumLong(rows: LongRow[], overrides: Record<string, Category> = {}): { totals: Record<string, Record<Category, number>>; skipped: number } {
  const totals: Record<string, Record<Category, number>> = {}
  let skipped = 0
  for (const r of rows) {
    if (r.amount === null) { skipped += 1; continue }
    const cat = classifyMenu(r.menu, overrides)
    totals[r.date] ??= emptyTotals()
    totals[r.date]![cat] += r.amount
  }
  return { totals, skipped }
}

/** 넓게 형식: 한 줄이 한 날짜이고 메뉴마다 열이 있습니다. 같은 카테고리 열들을 더합니다. */
export function sumWide(
  rows: Array<Record<string, string>>,
  dateCol: string,
  menuCols: string[],
  overrides: Record<string, Category> = {},
): Record<string, Record<Category, number>> {
  const totals: Record<string, Record<Category, number>> = {}
  for (const row of rows) {
    const date = row[dateCol]?.trim() ?? ''
    if (date === '') continue
    totals[date] ??= emptyTotals()
    for (const col of menuCols) {
      const amount = Number((row[col] ?? '').replace(/,/g, ''))
      if (!Number.isFinite(amount) || (row[col] ?? '').trim() === '') continue
      totals[date]![classifyMenu(col, overrides)] += amount
    }
  }
  return totals
}

function emptyTotals(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
}
