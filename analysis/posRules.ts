/**
 * 이 파일이 하는 일: POS 리포트의 상품 줄을 "메뉴", "옵션", "진동벨", "배달료", "기타 표시"로 나누고,
 *   같은 메뉴의 이름 변형(수량, 차수, 공지 문구, 띄어쓰기, 대소문자)을 한 이름으로 맞춥니다.
 * 입력: 상품명, POS 카테고리
 * 출력: 줄의 종류, 메뉴 기본 이름, 메뉴 키, POS 카테고리 키
 * 주의점: 옵션 이름 목록과 이름 변형 규칙은 실제 리포트에서 확인한 값입니다. 새 형태가 나오면 여기와 테스트를 함께 고칩니다.
 *         "아샷추"는 옵션이 아니라 메뉴입니다. 규칙에 맞지 않는 줄은 모두 메뉴로 봅니다.
 */

/** 주문 옵션으로 쓰이는 상품 줄. 매출에는 포함하고, 메뉴에 붙일 수 있을 때만 메뉴에 붙입니다. */
export const OPTION_NAMES: readonly string[] = [
  '샷추가', '연하게', '덜 달게', '오트밀크 변경', '크림추가', '연유 추가', '디카페인 변경',
]

export const BELL_CATEGORY = '진동벨'
export const DELIVERY_FEE_NAME = '배달료'
/** 포장 표시 등 메뉴가 아닌 0원 줄 */
export const SERVICE_NAMES: readonly string[] = ['T/O']

export type LineKind = 'menu' | 'option' | 'bell' | 'delivery_fee' | 'service'

/** 상품 줄 하나의 종류. 숫자만 있는 이름은 진동벨 번호입니다. */
export function lineKind(name: string, posCategory: string): LineKind {
  const n = name.trim()
  if (posCategory.trim() === BELL_CATEGORY || /^\d+$/.test(n)) return 'bell'
  if (n === DELIVERY_FEE_NAME) return 'delivery_fee'
  if (SERVICE_NAMES.includes(n)) return 'service'
  if (OPTION_NAMES.includes(n)) return 'option'
  return 'menu'
}

/**
 * 메뉴 기본 이름: 수량 표시, 차수, 공지 문구를 떼어 냅니다.
 * 예: "두바이 쫀득쿠키 (2개)" → "두바이 쫀득쿠키", "New) 두바이 쫀득쿠키 / 11시에 나와요 (2개)" → "두바이 쫀득쿠키"
 */
export function baseMenuName(name: string): string {
  let n = name.trim().replace(/^New\)\s*/i, '')
  n = n.replace(/\s*\/.*$/, '')  // "/ 11시에 나와요" 같은 공지는 슬래시 뒤에 붙습니다
  let prev = ''
  while (prev !== n) {            // 개수, 차수, 시각 공지가 여러 개 붙어도 모두 뗍니다
    prev = n
    n = n
      .replace(/\s*\(\d+개\)\s*$/, '')
      .replace(/\s*\(\d+차\)\s*$/, '')
      .replace(/\s+\d+차\s*$/, '')
      .replace(/\s*\d{1,2}시(\s*\d{1,2}분)?(에)?(\s*(나와요|나와용|나오는))?\s*$/, '')
      .replace(/\s*(나와요|나와용)\s*$/, '')
      .trim()
  }
  n = n.replace(/\s*\((ice|hot)\)\s*$/i, '')   // 온도(ice, hot)는 같은 메뉴의 선택 사항으로 봅니다
  n = n.replace(/두바이존득쿠키/g, '두바이 쫀득쿠키') // 철자 변형
  return n.replace(/\s+/g, ' ').trim()
}

/** 같은 메뉴를 묶는 키. 기본 이름에서 띄어쓰기와 대소문자 차이를 없앱니다. */
export function menuKey(name: string): string {
  return baseMenuName(name).replace(/\s+/g, '').toLowerCase()
}

/** POS 카테고리 키. 빈 값은 "(미분류)", 대소문자 차이(Smoothie, SMOOTHIE)는 하나로 봅니다. */
export function posCategoryKey(category: string): string {
  const t = category.trim()
  return t === '' ? '(미분류)' : t.toUpperCase()
}
