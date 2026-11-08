/**
 * 이 파일이 하는 일: 기상청 동네예보 격자 응답(글자 목록)에서 한 격자 칸(nx, ny)의 값을 꺼냅니다.
 * 입력: 응답 글자, 격자 번호 nx(1~149), ny(1~253), 격자 가로 칸 수(149), 세로 칸 수(253)
 * 출력: 값(숫자), 결측이면 null
 * 주의점: 응답은 헤더 없이 숫자만 옵니다. 가로 149개씩 한 줄이며, 맨 앞 줄이 ny=1(남쪽)입니다.
 *         확인 방법 (2026-11-05): 격자 좌표표(weather/reference/grid_points.csv)의 위도와 값의 상관을 보면
 *         이 방식이 맞습니다 (상관 -0.66, 반대 방식은 +0.68).
 *         따라서 행 번호는 (ny - 1)입니다. 결측 값은 -99입니다 (바다 등).
 */

export const GRID_WIDTH = 149
export const GRID_HEIGHT = 253
export const GRID_MISSING = -99

/** 응답 글자에서 숫자만 뽑습니다. 줄바꿈과 쉼표는 모두 구분자입니다. */
export function parseGridValues(text: string): number[] {
  return text.split(/[\s,]+/).filter((t) => /^-?\d/.test(t)).map(Number)
}

/** 격자 칸 (nx, ny)의 값. 칸 번호가 범위를 벗어나거나 결측이면 null입니다. */
export function gridValueAt(values: number[], nx: number, ny: number): number | null {
  if (nx < 1 || nx > GRID_WIDTH || ny < 1 || ny > GRID_HEIGHT) return null
  const v = values[(ny - 1) * GRID_WIDTH + (nx - 1)]
  if (v === undefined || v <= GRID_MISSING) return null
  return v
}
