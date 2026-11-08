/** POS 제외 줄 종류의 한국어 이름 (화면 표시용). */
export const CATEGORY_NAME_OF_BELL: Record<string, string> = {
  bell: '진동벨',
  option: '옵션',
  delivery_fee: '배달료',
  service: '포장 표시',
}

/** 파일 안의 POS 카테고리 이름을 사장님이 아는 한국어로 바꿉니다. 모르는 이름은 그대로 둡니다. */
export function categoryLabel(name: string): string {
  const map: Record<string, string> = {
    COFFEE: '커피',
    'NON COFFEE': '논커피 음료',
    DESSERT: '디저트·빵',
    TEA: '차',
    '디카페인': '디카페인 커피',
    SMOOTHIE: '스무디',
    ADE: '에이드',
    '굿즈': '굿즈',
    '(미분류)': '분류 안 된 메뉴',
  }
  return map[name] ?? name
}

/** 파일 열 이름(내부 이름)을 사장님 파일의 열 이름으로 바꿉니다. */
export function columnLabel(internal: string): string {
  const map: Record<string, string> = { date: '기간(날짜)', sales: '결제금액', transactions: '결제건수' }
  return map[internal] ?? internal
}
