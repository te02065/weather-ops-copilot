/**
 * 이 파일이 하는 일: 초등학생도 읽을 수 있게 숫자를 말로 바꾸는 작은 도우미 함수들입니다.
 * 입력: 원 단위 금액, 퍼센트, 날짜(YYYY-MM-DD)
 * 출력: "약 10만 원", "18%", "목요일" 같은 문자열
 * 주의점: 정확한 값은 "자세히 보기"에 따로 둡니다. 여기서는 반올림한 값만 씁니다.
 */

const NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** 원 단위 금액을 "약 10만 원" 꼴로. 1만 원 미만이면 "1만 원 미만". */
export function plainWon(x: number): string {
  const abs = Math.abs(x)
  if (abs < 10000) return '1만 원 미만'
  return `약 ${Math.round(abs / 10000)}만 원`
}

/** 정수 원 금액 (천 단위 쉼표). 예: ₩568,214 */
export function exactWon(x: number): string {
  return `₩${Math.round(x).toLocaleString('ko-KR')}`
}

/** 퍼센트를 정수로. 예: -18.3 → "18%" (부호는 호출하는 쪽에서 붙입니다). */
export function plainPercent(x: number): string {
  return `${Math.round(Math.abs(x))}%`
}

/** 날짜의 요일 이름. 예: 2026-11-05 → 목요일 */
export function weekdayName(iso: string): string {
  return NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()]!
}
