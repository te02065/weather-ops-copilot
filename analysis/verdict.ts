/**
 * 이 파일이 하는 일: 날씨 모델(M1)을 채택, 보류, 기각 중 하나로 판정합니다 (방법론 §9.4). 판정 규칙은 이 파일에만 있습니다.
 * 입력: ΔMAE 점추정, 95% 구간 하한과 상한 (ΔMAE = M1 오차 − 기준선 A 오차, 음수일수록 M1이 좋음)
 * 출력: 'adopt' | 'hold' | 'reject' 와 사람이 읽을 문장
 * 주의점: 판정 규칙을 다른 곳에서 따로 만들지 마세요. 규칙을 바꾸면 방법론 버전을 올려야 합니다.
 */

export type Verdict = 'adopt' | 'hold' | 'reject'

export function decideVerdict(deltaMae: number, upper: number): Verdict {
  if (deltaMae >= 0) return 'reject'
  return upper < 0 ? 'adopt' : 'hold'
}

/** 방법론 §9.4의 표현 그대로 쓴 문장. */
export function verdictSentence(v: Verdict): string {
  if (v === 'adopt') return '이 기간 이 매장에서 날씨 정보가 기준선보다 낮은 오차를 보였다.'
  if (v === 'hold') return '차이가 있었으나 불확실하다.'
  return '날씨 모델은 기준선을 넘지 못했다.'
}
